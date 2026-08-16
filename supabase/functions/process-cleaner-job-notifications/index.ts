import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const esc=(v:unknown)=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const phone=(v:string)=>{const n=v.replace(/\D/g,"");return n.startsWith("44")?`+${n}`:n.startsWith("0")?`+44${n.slice(1)}`:`+44${n}`};
const money=(p:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(p/100);
const render=(value:string,vars:Record<string,string>)=>Object.entries(vars).reduce((out,[key,val])=>out.replaceAll(`{{${key}}}`,val),value);

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return json({ok:true});
  try{
    const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,resendKey=Deno.env.get("RESEND_API_KEY");
    if(!resendKey)throw new Error("RESEND_API_KEY is not configured");
    const db=createClient(url,key),resend=new Resend(resendKey);
    const {data:due,error}=await db.from("cleaner_job_notifications").select("id,assignment_id,job_id,cleaner_id,notification_type,channel,attempts").in("status",["pending","failed"]).lte("scheduled_for",new Date().toISOString()).lt("attempts",5).order("scheduled_for").limit(25);
    if(error)throw error;
    const results=[];
    for(const item of due||[]){
      const {data:claimed}=await db.from("cleaner_job_notifications").update({status:"processing",attempts:item.attempts+1,updated_at:new Date().toISOString()}).eq("id",item.id).in("status",["pending","failed"]).select("id").maybeSingle();
      if(!claimed)continue;
      try{
        const {data:a,error:aErr}=await db.from("job_assignments").select("id,status,cleaner:cleaner_profiles(user_id,full_name,phone),job:jobs(reference,status,scheduled_date,start_time,expected_duration_minutes,cleaner_payout_pence,requirements,service_type:service_types(name),customer:customers(name,email),address:customer_addresses(address_line_1,address_line_2,city,postcode,access_notes))").eq("id",item.assignment_id).single();
        if(aErr||!a)throw aErr||new Error("Assignment not found");
        if(item.notification_type!=="offer_email"&&!['accepted','completed'].includes(a.status))throw new Error("Assignment is no longer accepted");
        if(item.notification_type==="offer_email"&&a.status!=="offered")throw new Error("Offer is no longer active");
        const cleaner=a.cleaner as any,j=a.job as any;
        const {data:user,error:uErr}=await db.auth.admin.getUserById(cleaner.user_id);if(uErr||!user.user?.email)throw uErr||new Error("Cleaner email not found");
        const when=new Date(`${j.scheduled_date}T12:00:00`).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
        const exact=item.notification_type!=="offer_email";
        const address=exact?[j.address.address_line_1,j.address.address_line_2,j.address.city,j.address.postcode].filter(Boolean).join(", "):j.address.postcode;
        const templateNames:any={offer_email:"cleaner_job_offer",assigned_email:"cleaner_assignment_confirmed",reminder_3_day_email:"cleaner_reminder_3_day",reminder_1_day_email:"cleaner_reminder_1_day",reminder_day_email:"cleaner_reminder_day",reminder_day_sms:"cleaner_reminder_day_sms",customer_reminder_3_day_email:"customer_reminder_3_day",customer_reminder_1_day_email:"customer_reminder_1_day",customer_reminder_day_email:"customer_reminder_day"};
        const variables:Record<string,string>={cleaner_name:cleaner.full_name||"there",customer_name:j.customer.name,service_name:j.service_type.name,scheduled_date:when,start_time:j.start_time?.slice(0,5)||"TBC",duration:j.expected_duration_minutes?`${j.expected_duration_minutes/60} hours`:"TBC",postcode:j.address.postcode,full_address:address,access_notes:j.address.access_notes||"None",instructions:j.requirements||"Standard Cleanda checklist applies",cleaner_payout:money(j.cleaner_payout_pence),job_reference:j.reference};
        const {data:template}=await db.from("email_templates").select("subject,body,is_active").eq("name",templateNames[item.notification_type]).maybeSingle();
        if(!template?.is_active){await db.from("cleaner_job_notifications").update({status:"cancelled",last_error:"Template disabled",updated_at:new Date().toISOString()}).eq("id",item.id);results.push({id:item.id,status:"cancelled"});continue;}
        const subject=render(template.subject,variables),content=render(template.body,variables);
        let providerRef="";
        if(item.channel==="email"){
          const recipient=item.notification_type.startsWith("customer_")?j.customer.email:user.user.email;
          if(!recipient)throw new Error("Recipient email not found");
          const {data,error:e}=await resend.emails.send({from:"Cleanda <hello@cleanda.co.uk>",to:[recipient],subject,html:`<div style="font-family:Arial;max-width:620px;margin:auto">${content}<p>Cleanda Operations</p></div>`});if(e)throw e;providerRef=data?.id||"";
        }else{
          if(!cleaner.phone)throw new Error("Cleaner phone not found");const sid=Deno.env.get("TWILIO_ACCOUNT_SID"),token=Deno.env.get("TWILIO_AUTH_TOKEN"),from=Deno.env.get("TWILIO_SMS_FROM");if(!sid||!token||!from)throw new Error("Twilio SMS credentials are not configured");
          const form=new URLSearchParams({To:phone(cleaner.phone),From:from,Body:content.replace(/<[^>]+>/g,"")});const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:"POST",headers:{Authorization:`Basic ${btoa(`${sid}:${token}`)}`,"Content-Type":"application/x-www-form-urlencoded"},body:form});const result=await response.json();if(!response.ok)throw new Error(result.message||"Twilio delivery failed");providerRef=result.sid;
        }
        await db.from("cleaner_job_notifications").update({status:"sent",sent_at:new Date().toISOString(),provider_reference:providerRef,last_error:null,updated_at:new Date().toISOString()}).eq("id",item.id);results.push({id:item.id,status:"sent",type:item.notification_type});
      }catch(e){await db.from("cleaner_job_notifications").update({status:"failed",last_error:String((e as Error).message||e).slice(0,1000),updated_at:new Date().toISOString()}).eq("id",item.id);results.push({id:item.id,status:"failed",error:String((e as Error).message||e)});}
    }
    return json({processed:results.length,results});
  }catch(e){return json({error:String((e as Error).message||e)},500);}
});
