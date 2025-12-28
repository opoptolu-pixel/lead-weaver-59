import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  Plus,
  Pencil,
  Eye,
  Mail,
  Variable,
  Code,
  Send,
  BarChart3,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { VariableAutocompleteTextarea } from "@/components/admin/VariableAutocompleteTextarea";
import { EmailLogsPanel } from "@/components/admin/EmailLogsPanel";
import { ScheduledEmailsPanel } from "@/components/admin/ScheduledEmailsPanel";
import { useAuth } from "@/contexts/AuthContext";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  description: string | null;
  variables: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_TEMPLATES = [
  {
    name: "cleaning_request_confirmation",
    subject: "Your Cleaning Request is Confirmed ✓ Ref #{{reference_id}}",
    description: "Sent to customers when they submit a cleaning request",
    variables: ["customer_name", "job_type", "preferred_date", "postcode", "reference_id", "current_year"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f4f3; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0f4f3; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(11, 61, 46, 0.08);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); padding: 40px 40px 35px 40px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="width: 60px; height: 60px; background-color: rgba(255,255,255,0.15); border-radius: 12px; margin-bottom: 16px; display: inline-block; line-height: 60px;">
                      <span style="font-size: 28px;">🧹</span>
                    </div>
                    <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">✨ Cleanda</h1>
                    <p style="color: #7DD3A8; margin: 6px 0 0 0; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Professional Cleaning Network</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Success Banner -->
          <tr>
            <td style="padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #E8F5E9;">
                <tr>
                  <td style="padding: 20px 40px; text-align: center;">
                    <span style="display: inline-block; background-color: #4CAF50; color: white; font-size: 18px; width: 32px; height: 32px; line-height: 32px; border-radius: 50%; margin-right: 10px;">✓</span>
                    <span style="color: #2E7D32; font-size: 18px; font-weight: 600;">Request Successfully Submitted</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 35px 40px;">
              <p style="color: #333333; font-size: 17px; line-height: 1.7; margin: 0 0 25px 0;">
                Hi <strong>{{customer_name}}</strong>,
              </p>
              <p style="color: #555555; font-size: 16px; line-height: 1.7; margin: 0 0 30px 0;">
                Thank you for choosing Cleanda! Your cleaning request has been received and we are now matching you with a trusted, verified cleaner in your area.
              </p>
              
              <!-- Booking Details Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #fafbfc 0%, #f5f7f6 100%); border-radius: 12px; border: 1px solid #e8ebe9; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="color: #0B3D2E; margin: 0 0 20px 0; font-size: 15px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Your Booking Details</h3>
                    
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e8ebe9;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td width="40" valign="top"><span style="font-size: 20px;">🏷️</span></td>
                              <td>
                                <span style="color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Reference</span><br>
                                <span style="color: #0B3D2E; font-size: 18px; font-weight: 700;">#{{reference_id}}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e8ebe9;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td width="40" valign="top"><span style="font-size: 20px;">🧽</span></td>
                              <td>
                                <span style="color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Service</span><br>
                                <span style="color: #333333; font-size: 16px; font-weight: 500;">{{job_type}}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e8ebe9;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td width="40" valign="top"><span style="font-size: 20px;">📅</span></td>
                              <td>
                                <span style="color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Preferred Date</span><br>
                                <span style="color: #333333; font-size: 16px; font-weight: 500;">{{preferred_date}}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td width="40" valign="top"><span style="font-size: 20px;">📍</span></td>
                              <td>
                                <span style="color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Location</span><br>
                                <span style="color: #333333; font-size: 16px; font-weight: 500;">{{postcode}}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- What Happens Next -->
              <h3 style="color: #0B3D2E; margin: 0 0 18px 0; font-size: 18px; font-weight: 600;">What Happens Next?</h3>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 10px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="36" valign="top">
                          <div style="width: 28px; height: 28px; background-color: #0B3D2E; color: white; border-radius: 50%; text-align: center; line-height: 28px; font-size: 14px; font-weight: 600;">1</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="color: #333333; font-size: 15px; margin: 0; line-height: 1.5;"><strong>Matching in progress</strong> — We are finding the best cleaner for your job</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="36" valign="top">
                          <div style="width: 28px; height: 28px; background-color: #0B3D2E; color: white; border-radius: 50%; text-align: center; line-height: 28px; font-size: 14px; font-weight: 600;">2</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="color: #333333; font-size: 15px; margin: 0; line-height: 1.5;"><strong>Cleaner contacts you</strong> — Within 24 hours to confirm details</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="36" valign="top">
                          <div style="width: 28px; height: 28px; background-color: #0B3D2E; color: white; border-radius: 50%; text-align: center; line-height: 28px; font-size: 14px; font-weight: 600;">3</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="color: #333333; font-size: 15px; margin: 0; line-height: 1.5;"><strong>Enjoy a sparkling clean space!</strong></p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0B3D2E; padding: 30px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="color: #7DD3A8; font-size: 14px; margin: 0 0 8px 0;">Questions? Just reply to this email.</p>
                    <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0;">
                      © {{current_year}} Cleanda · All rights reserved
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    name: "lead_available_notification",
    subject: "🔔 New {{job_type}} Lead in {{postcode_area}} — Act Fast!",
    description: "Sent to businesses when a new lead matches their area",
    variables: ["business_name", "contact_name", "job_type", "postcode_area", "display_value", "lead_date", "dashboard_url", "current_year"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f4f3; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0f4f3; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(11, 61, 46, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); padding: 35px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">✨ Cleanda</h1>
              <p style="color: #7DD3A8; margin: 6px 0 0 0; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Partner Network</p>
            </td>
          </tr>
          
          <!-- Alert Banner -->
          <tr>
            <td style="padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(90deg, #FF6B35 0%, #F7931E 100%);">
                <tr>
                  <td style="padding: 16px 40px; text-align: center;">
                    <span style="color: #ffffff; font-size: 15px; font-weight: 600;">🔥 New Lead Available — First Come, First Served!</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 35px 40px;">
              <p style="color: #333333; font-size: 17px; line-height: 1.6; margin: 0 0 25px 0;">
                Hi <strong>{{contact_name}}</strong>,
              </p>
              <p style="color: #555555; font-size: 16px; line-height: 1.7; margin: 0 0 28px 0;">
                Great news! A new cleaning lead has just come in that matches your service area. Act quickly to secure this job before another cleaner does.
              </p>
              
              <!-- Lead Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%); border-radius: 12px; border: 2px solid #4CAF50; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 28px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td colspan="2" style="padding-bottom: 18px; border-bottom: 1px solid rgba(76, 175, 80, 0.3);">
                          <span style="background-color: #4CAF50; color: white; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px;">New Lead</span>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding: 18px 10px 18px 0; vertical-align: top;">
                          <span style="color: #666666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Service Type</span><br>
                          <span style="color: #0B3D2E; font-size: 18px; font-weight: 700; display: block; margin-top: 4px;">{{job_type}}</span>
                        </td>
                        <td width="50%" style="padding: 18px 0 18px 10px; vertical-align: top; border-left: 1px solid rgba(76, 175, 80, 0.3);">
                          <span style="color: #666666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Estimated Value</span><br>
                          <span style="color: #2E7D32; font-size: 18px; font-weight: 700; display: block; margin-top: 4px;">{{display_value}}</span>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding: 0 10px 0 0; vertical-align: top;">
                          <span style="color: #666666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">📍 Area</span><br>
                          <span style="color: #333333; font-size: 16px; font-weight: 600; display: block; margin-top: 4px;">{{postcode_area}}</span>
                        </td>
                        <td width="50%" style="padding: 0 0 0 10px; vertical-align: top; border-left: 1px solid rgba(76, 175, 80, 0.3);">
                          <span style="color: #666666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">📅 Date Needed</span><br>
                          <span style="color: #333333; font-size: 16px; font-weight: 600; display: block; margin-top: 4px;">{{lead_date}}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 25px 0;">
                    <a href="{{dashboard_url}}" style="display: inline-block; background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(11, 61, 46, 0.3);">View Lead & Unlock →</a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #888888; font-size: 13px; text-align: center; margin: 0; line-height: 1.5;">
                Leads are available on a first-come, first-served basis.<br>
                Use 1 credit to unlock full customer details.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0B3D2E; padding: 25px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0;">
                      You are receiving this because you are a registered Cleanda partner.<br>
                      © {{current_year}} Cleanda
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    name: "welcome_business",
    subject: "Welcome to Cleanda, {{business_name}}! 🎉",
    description: "Sent to new businesses when they sign up",
    variables: ["business_name", "contact_name", "dashboard_url", "current_year"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f4f3; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0f4f3; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(11, 61, 46, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); padding: 50px 40px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Welcome to Cleanda!</h1>
              <p style="color: #7DD3A8; margin: 10px 0 0 0; font-size: 16px;">You are now part of our trusted cleaner network</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #333333; font-size: 17px; line-height: 1.6; margin: 0 0 25px 0;">
                Hi <strong>{{contact_name}}</strong>,
              </p>
              <p style="color: #555555; font-size: 16px; line-height: 1.7; margin: 0 0 30px 0;">
                Welcome aboard! We are thrilled to have <strong>{{business_name}}</strong> join our growing network of professional cleaners across the UK. You now have access to quality leads in your area.
              </p>
              
              <!-- Getting Started Steps -->
              <h3 style="color: #0B3D2E; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">Get Started in 4 Simple Steps</h3>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 30px;">
                <tr>
                  <td style="padding: 16px; background-color: #f8faf9; border-radius: 10px; margin-bottom: 12px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="50" valign="top">
                          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #0B3D2E, #145A44); color: white; border-radius: 50%; text-align: center; line-height: 36px; font-size: 16px; font-weight: 700;">1</div>
                        </td>
                        <td style="padding-left: 8px;">
                          <p style="color: #0B3D2E; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Complete Your Verification</p>
                          <p style="color: #666666; font-size: 14px; margin: 0;">Upload your business documents to get verified</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height: 12px;"></td></tr>
                <tr>
                  <td style="padding: 16px; background-color: #f8faf9; border-radius: 10px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="50" valign="top">
                          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #0B3D2E, #145A44); color: white; border-radius: 50%; text-align: center; line-height: 36px; font-size: 16px; font-weight: 700;">2</div>
                        </td>
                        <td style="padding-left: 8px;">
                          <p style="color: #0B3D2E; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Add Credits to Your Account</p>
                          <p style="color: #666666; font-size: 14px; margin: 0;">Purchase credit packs to unlock leads</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height: 12px;"></td></tr>
                <tr>
                  <td style="padding: 16px; background-color: #f8faf9; border-radius: 10px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="50" valign="top">
                          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #0B3D2E, #145A44); color: white; border-radius: 50%; text-align: center; line-height: 36px; font-size: 16px; font-weight: 700;">3</div>
                        </td>
                        <td style="padding-left: 8px;">
                          <p style="color: #0B3D2E; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Browse Available Leads</p>
                          <p style="color: #666666; font-size: 14px; margin: 0;">Find cleaning jobs in your area</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height: 12px;"></td></tr>
                <tr>
                  <td style="padding: 16px; background-color: #f8faf9; border-radius: 10px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="50" valign="top">
                          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #0B3D2E, #145A44); color: white; border-radius: 50%; text-align: center; line-height: 36px; font-size: 16px; font-weight: 700;">4</div>
                        </td>
                        <td style="padding-left: 8px;">
                          <p style="color: #0B3D2E; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Win Jobs & Grow Your Business</p>
                          <p style="color: #666666; font-size: 14px; margin: 0;">Contact customers and deliver great service</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0;">
                    <a href="{{dashboard_url}}" style="display: inline-block; background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(11, 61, 46, 0.3);">Go to Your Dashboard →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0B3D2E; padding: 30px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="color: #7DD3A8; font-size: 14px; margin: 0 0 8px 0;">Need help? Reply to this email anytime.</p>
                    <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0;">
                      © {{current_year}} Cleanda · All rights reserved
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    name: "lead_unlocked",
    subject: "🎉 Lead Unlocked — Customer Details for {{job_type}} in {{postcode}}",
    description: "Sent to businesses when they unlock a lead",
    variables: ["business_name", "contact_name", "job_type", "customer_name", "customer_phone", "customer_email", "customer_address", "postcode", "preferred_date", "display_value", "dashboard_url", "current_year"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f4f3; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0f4f3; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(11, 61, 46, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); padding: 35px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">✨ Cleanda</h1>
              <p style="color: #7DD3A8; margin: 6px 0 0 0; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Partner Network</p>
            </td>
          </tr>
          
          <!-- Success Banner -->
          <tr>
            <td style="padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(90deg, #4CAF50 0%, #66BB6A 100%);">
                <tr>
                  <td style="padding: 16px 40px; text-align: center;">
                    <span style="color: #ffffff; font-size: 15px; font-weight: 600;">🎉 Lead Unlocked — Contact This Customer Now!</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 35px 40px;">
              <p style="color: #333333; font-size: 17px; line-height: 1.6; margin: 0 0 25px 0;">
                Hi <strong>{{contact_name}}</strong>,
              </p>
              <p style="color: #555555; font-size: 16px; line-height: 1.7; margin: 0 0 28px 0;">
                Great news! You've successfully unlocked a new lead. Contact this customer as soon as possible to secure the job.
              </p>
              
              <!-- Customer Details Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%); border-radius: 12px; border: 2px solid #4CAF50; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 28px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td colspan="2" style="padding-bottom: 18px; border-bottom: 1px solid rgba(76, 175, 80, 0.3);">
                          <span style="background-color: #4CAF50; color: white; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Customer Details</span>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding: 18px 10px 12px 0; vertical-align: top;">
                          <span style="color: #666666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">👤 Name</span><br>
                          <span style="color: #0B3D2E; font-size: 18px; font-weight: 700; display: block; margin-top: 4px;">{{customer_name}}</span>
                        </td>
                        <td width="50%" style="padding: 18px 0 12px 10px; vertical-align: top; border-left: 1px solid rgba(76, 175, 80, 0.3);">
                          <span style="color: #666666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">💰 Est. Value</span><br>
                          <span style="color: #2E7D32; font-size: 18px; font-weight: 700; display: block; margin-top: 4px;">{{display_value}}</span>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding: 12px 10px 12px 0; vertical-align: top;">
                          <span style="color: #666666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">📞 Phone</span><br>
                          <a href="tel:{{customer_phone}}" style="color: #0B3D2E; font-size: 16px; font-weight: 700; display: block; margin-top: 4px; text-decoration: none;">{{customer_phone}}</a>
                        </td>
                        <td width="50%" style="padding: 12px 0 12px 10px; vertical-align: top; border-left: 1px solid rgba(76, 175, 80, 0.3);">
                          <span style="color: #666666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">✉️ Email</span><br>
                          <a href="mailto:{{customer_email}}" style="color: #0B3D2E; font-size: 14px; font-weight: 600; display: block; margin-top: 4px; text-decoration: none; word-break: break-all;">{{customer_email}}</a>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 12px 0; border-top: 1px solid rgba(76, 175, 80, 0.3);">
                          <span style="color: #666666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">📍 Address</span><br>
                          <span style="color: #333333; font-size: 15px; font-weight: 600; display: block; margin-top: 4px;">{{customer_address}}</span>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding: 12px 10px 0 0; vertical-align: top;">
                          <span style="color: #666666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">🧽 Service</span><br>
                          <span style="color: #333333; font-size: 15px; font-weight: 600; display: block; margin-top: 4px;">{{job_type}}</span>
                        </td>
                        <td width="50%" style="padding: 12px 0 0 10px; vertical-align: top; border-left: 1px solid rgba(76, 175, 80, 0.3);">
                          <span style="color: #666666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">📅 Preferred Date</span><br>
                          <span style="color: #333333; font-size: 15px; font-weight: 600; display: block; margin-top: 4px;">{{preferred_date}}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Pro Tip Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%); border-radius: 12px; border: 1px solid #FFD54F; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="36" valign="top">
                          <div style="width: 32px; height: 32px; background-color: #FFC107; border-radius: 50%; text-align: center; line-height: 32px; font-size: 16px;">💡</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="color: #F57C00; font-size: 14px; font-weight: 700; margin: 0 0 4px 0;">Pro Tip</p>
                          <p style="color: #795548; font-size: 14px; margin: 0; line-height: 1.5;">Call within the first hour to increase your chance of winning this job by 3x!</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 25px 0;">
                    <a href="{{dashboard_url}}" style="display: inline-block; background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(11, 61, 46, 0.3);">View in Dashboard →</a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #888888; font-size: 13px; text-align: center; margin: 0; line-height: 1.5;">
                Remember to update the lead status once you've contacted the customer.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0B3D2E; padding: 25px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0;">
                      You are receiving this because you are a registered Cleanda partner.<br>
                      © {{current_year}} Cleanda
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    name: "password_reset",
    subject: "🔐 Reset Your Cleanda Password",
    description: "Sent when a user requests a password reset",
    variables: ["user_name", "reset_link", "expiry_hours", "current_year"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f4f3; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0f4f3; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(11, 61, 46, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); padding: 40px; text-align: center;">
              <div style="width: 60px; height: 60px; background-color: rgba(255,255,255,0.15); border-radius: 12px; margin: 0 auto 16px auto; line-height: 60px;">
                <span style="font-size: 28px;">🔐</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Password Reset Request</h1>
              <p style="color: #7DD3A8; margin: 8px 0 0 0; font-size: 14px;">Secure your account with a new password</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #333333; font-size: 17px; line-height: 1.6; margin: 0 0 25px 0;">
                Hi <strong>{{user_name}}</strong>,
              </p>
              <p style="color: #555555; font-size: 16px; line-height: 1.7; margin: 0 0 30px 0;">
                We received a request to reset your password for your Cleanda account. Click the button below to create a new, secure password.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px 0;">
                    <a href="{{reset_link}}" style="display: inline-block; background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); color: #ffffff; padding: 16px 50px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(11, 61, 46, 0.3);">Reset My Password →</a>
                  </td>
                </tr>
              </table>
              
              <!-- Warning Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%); border-radius: 12px; border: 1px solid #FFB74D; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="36" valign="top">
                          <div style="width: 32px; height: 32px; background-color: #FF9800; border-radius: 50%; text-align: center; line-height: 32px; font-size: 16px;">⏰</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="color: #E65100; font-size: 14px; font-weight: 700; margin: 0 0 4px 0;">Link Expires Soon</p>
                          <p style="color: #795548; font-size: 14px; margin: 0; line-height: 1.5;">This password reset link will expire in <strong>{{expiry_hours}} hours</strong> for security reasons.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Security Info -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8faf9; border-radius: 12px; border: 1px solid #e8ebe9;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="color: #0B3D2E; font-size: 14px; font-weight: 600; margin: 0 0 10px 0;">🛡️ Security Notice</p>
                    <p style="color: #666666; font-size: 14px; margin: 0; line-height: 1.6;">
                      If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged and your account is secure.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0B3D2E; padding: 25px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0;">
                      This is an automated security email from Cleanda.<br>
                      © {{current_year}} Cleanda
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    name: "verification_approved",
    subject: "🎉 Congratulations! {{business_name}} is Now Verified",
    description: "Sent when a business verification is approved",
    variables: ["business_name", "contact_name", "dashboard_url", "current_year"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f4f3; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0f4f3; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(11, 61, 46, 0.08);">
          
          <!-- Header with Celebration -->
          <tr>
            <td style="background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); padding: 50px 40px; text-align: center;">
              <div style="font-size: 56px; margin-bottom: 16px;">🎉</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Congratulations!</h1>
              <p style="color: #7DD3A8; margin: 10px 0 0 0; font-size: 16px; font-weight: 500;">{{business_name}} is now verified</p>
            </td>
          </tr>
          
          <!-- Success Badge -->
          <tr>
            <td style="padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(90deg, #4CAF50 0%, #66BB6A 100%);">
                <tr>
                  <td style="padding: 16px 40px; text-align: center;">
                    <span style="color: #ffffff; font-size: 15px; font-weight: 600;">✓ Verification Complete — Full Platform Access Unlocked</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #333333; font-size: 17px; line-height: 1.6; margin: 0 0 25px 0;">
                Hi <strong>{{contact_name}}</strong>,
              </p>
              <p style="color: #555555; font-size: 16px; line-height: 1.7; margin: 0 0 30px 0;">
                Your business verification is complete. You now have full access to our lead marketplace and all premium features.
              </p>
              
              <!-- Benefits Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%); border-radius: 12px; border: 2px solid #4CAF50; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 28px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-bottom: 16px; border-bottom: 1px solid rgba(76, 175, 80, 0.3);">
                          <span style="background-color: #4CAF50; color: white; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px;">What's Unlocked</span>
                        </td>
                      </tr>
                    </table>
                    
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 16px;">
                      <tr>
                        <td style="padding: 12px 0;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td width="36" valign="top">
                                <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #4CAF50, #66BB6A); color: white; border-radius: 50%; text-align: center; line-height: 28px; font-size: 14px; font-weight: 700;">✓</div>
                              </td>
                              <td style="padding-left: 12px;">
                                <p style="color: #0B3D2E; font-size: 15px; font-weight: 600; margin: 0;"><strong>Unlimited Lead Purchases</strong></p>
                                <p style="color: #666666; font-size: 13px; margin: 4px 0 0 0;">No more 3-lead limit for unverified accounts</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td width="36" valign="top">
                                <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #4CAF50, #66BB6A); color: white; border-radius: 50%; text-align: center; line-height: 28px; font-size: 14px; font-weight: 700;">✓</div>
                              </td>
                              <td style="padding-left: 12px;">
                                <p style="color: #0B3D2E; font-size: 15px; font-weight: 600; margin: 0;"><strong>Verified Business Badge</strong></p>
                                <p style="color: #666666; font-size: 13px; margin: 4px 0 0 0;">Build instant trust with potential customers</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0 0 0;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td width="36" valign="top">
                                <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #4CAF50, #66BB6A); color: white; border-radius: 50%; text-align: center; line-height: 28px; font-size: 14px; font-weight: 700;">✓</div>
                              </td>
                              <td style="padding-left: 12px;">
                                <p style="color: #0B3D2E; font-size: 15px; font-weight: 600; margin: 0;"><strong>Priority Support</strong></p>
                                <p style="color: #666666; font-size: 13px; margin: 4px 0 0 0;">Get faster responses from our support team</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 25px 0;">
                    <a href="{{dashboard_url}}" style="display: inline-block; background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); color: #ffffff; padding: 16px 50px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(11, 61, 46, 0.3);">Start Getting Leads →</a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #888888; font-size: 13px; text-align: center; margin: 0; line-height: 1.5;">
                Top up your credits and start unlocking leads in your area today!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0B3D2E; padding: 25px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="color: #7DD3A8; font-size: 14px; margin: 0 0 8px 0;">Need help? Reply to this email anytime.</p>
                    <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0;">
                      © {{current_year}} Cleanda · All rights reserved
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    name: "verification_rejected",
    subject: "⚠️ Action Required: Verification Update for {{business_name}}",
    description: "Sent when a business verification is rejected",
    variables: ["business_name", "contact_name", "rejection_reason", "dashboard_url", "current_year"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f4f3; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0f4f3; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(11, 61, 46, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); padding: 35px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">✨ Cleanda</h1>
              <p style="color: #7DD3A8; margin: 6px 0 0 0; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Partner Network</p>
            </td>
          </tr>
          
          <!-- Alert Banner -->
          <tr>
            <td style="padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(90deg, #FF6B35 0%, #F7931E 100%);">
                <tr>
                  <td style="padding: 16px 40px; text-align: center;">
                    <span style="color: #ffffff; font-size: 15px; font-weight: 600;">⚠️ Verification Requires Additional Information</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #333333; font-size: 17px; line-height: 1.6; margin: 0 0 25px 0;">
                Hi <strong>{{contact_name}}</strong>,
              </p>
              <p style="color: #555555; font-size: 16px; line-height: 1.7; margin: 0 0 28px 0;">
                We've reviewed the verification documents for <strong>{{business_name}}</strong>, but we need some additional information before we can complete the verification.
              </p>
              
              <!-- Reason Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%); border-radius: 12px; border-left: 4px solid #EF5350; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="36" valign="top">
                          <div style="width: 32px; height: 32px; background-color: #EF5350; border-radius: 50%; text-align: center; line-height: 32px; font-size: 16px; color: white;">!</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="color: #C62828; font-size: 14px; font-weight: 700; margin: 0 0 8px 0;">Reason for Rejection</p>
                          <p style="color: #555555; font-size: 15px; margin: 0; line-height: 1.6;">{{rejection_reason}}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Next Steps -->
              <h3 style="color: #0B3D2E; margin: 0 0 20px 0; font-size: 17px; font-weight: 700;">How to Fix This</h3>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 30px;">
                <tr>
                  <td style="padding: 16px; background-color: #f8faf9; border-radius: 10px; margin-bottom: 12px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="50" valign="top">
                          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #0B3D2E, #145A44); color: white; border-radius: 50%; text-align: center; line-height: 36px; font-size: 16px; font-weight: 700;">1</div>
                        </td>
                        <td style="padding-left: 8px;">
                          <p style="color: #0B3D2E; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Review the Rejection Reason</p>
                          <p style="color: #666666; font-size: 14px; margin: 0;">Read the feedback above carefully</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height: 12px;"></td></tr>
                <tr>
                  <td style="padding: 16px; background-color: #f8faf9; border-radius: 10px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="50" valign="top">
                          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #0B3D2E, #145A44); color: white; border-radius: 50%; text-align: center; line-height: 36px; font-size: 16px; font-weight: 700;">2</div>
                        </td>
                        <td style="padding-left: 8px;">
                          <p style="color: #0B3D2E; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Prepare the Correct Documents</p>
                          <p style="color: #666666; font-size: 14px; margin: 0;">Gather the required documentation</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height: 12px;"></td></tr>
                <tr>
                  <td style="padding: 16px; background-color: #f8faf9; border-radius: 10px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="50" valign="top">
                          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #0B3D2E, #145A44); color: white; border-radius: 50%; text-align: center; line-height: 36px; font-size: 16px; font-weight: 700;">3</div>
                        </td>
                        <td style="padding-left: 8px;">
                          <p style="color: #0B3D2E; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Resubmit Your Application</p>
                          <p style="color: #666666; font-size: 14px; margin: 0;">Upload new documents in your dashboard</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 25px 0;">
                    <a href="{{dashboard_url}}" style="display: inline-block; background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(11, 61, 46, 0.3);">Resubmit Documents →</a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #888888; font-size: 13px; text-align: center; margin: 0; line-height: 1.5;">
                Need help? Reply to this email and we'll assist you with verification.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0B3D2E; padding: 25px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0;">
                      You are receiving this because you submitted a verification request.<br>
                      © {{current_year}} Cleanda
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    name: "document_approved",
    subject: "✓ Your {{document_type}} has been approved",
    description: "Sent when a specific verification document is approved",
    variables: ["business_name", "contact_name", "document_type", "admin_notes", "verification_url", "current_year"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f4f3; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0f4f3; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(11, 61, 46, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); padding: 35px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">✨ Cleanda</h1>
              <p style="color: #7DD3A8; margin: 6px 0 0 0; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Partner Network</p>
            </td>
          </tr>
          
          <!-- Success Banner -->
          <tr>
            <td style="padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(90deg, #4CAF50 0%, #66BB6A 100%);">
                <tr>
                  <td style="padding: 16px 40px; text-align: center;">
                    <span style="color: #ffffff; font-size: 15px; font-weight: 600;">✓ Document Approved</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #333333; font-size: 17px; line-height: 1.6; margin: 0 0 25px 0;">
                Hi <strong>{{contact_name}}</strong>,
              </p>
              <p style="color: #555555; font-size: 16px; line-height: 1.7; margin: 0 0 28px 0;">
                Great news! Your <strong>{{document_type}}</strong> for <strong>{{business_name}}</strong> has been reviewed and approved.
              </p>
              
              <!-- Success Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%); border-radius: 12px; border: 2px solid #4CAF50; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="36" valign="top">
                          <div style="width: 32px; height: 32px; background-color: #4CAF50; border-radius: 50%; text-align: center; line-height: 32px; font-size: 16px; color: white;">✓</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="color: #2E7D32; font-size: 14px; font-weight: 700; margin: 0 0 4px 0;">Document Verified</p>
                          <p style="color: #555555; font-size: 14px; margin: 0; line-height: 1.5;">{{document_type}} has passed our verification checks.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="color: #555555; font-size: 16px; line-height: 1.7; margin: 0 0 28px 0;">
                You're one step closer to becoming a fully verified business on Cleanda. Continue with any remaining verification steps in your dashboard.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 25px 0;">
                    <a href="{{verification_url}}" style="display: inline-block; background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(11, 61, 46, 0.3);">View Verification Status →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0B3D2E; padding: 25px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="color: #7DD3A8; font-size: 14px; margin: 0 0 8px 0;">Questions? Reply to this email.</p>
                    <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0;">
                      © {{current_year}} Cleanda · All rights reserved
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    name: "document_rejected",
    subject: "⚠️ Action Required: Your {{document_type}} needs attention",
    description: "Sent when a specific verification document is rejected",
    variables: ["business_name", "contact_name", "document_type", "rejection_reason", "verification_url", "current_year"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f4f3; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0f4f3; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(11, 61, 46, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); padding: 35px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">✨ Cleanda</h1>
              <p style="color: #7DD3A8; margin: 6px 0 0 0; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Partner Network</p>
            </td>
          </tr>
          
          <!-- Alert Banner -->
          <tr>
            <td style="padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(90deg, #FF6B35 0%, #F7931E 100%);">
                <tr>
                  <td style="padding: 16px 40px; text-align: center;">
                    <span style="color: #ffffff; font-size: 15px; font-weight: 600;">⚠️ Document Requires Attention</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #333333; font-size: 17px; line-height: 1.6; margin: 0 0 25px 0;">
                Hi <strong>{{contact_name}}</strong>,
              </p>
              <p style="color: #555555; font-size: 16px; line-height: 1.7; margin: 0 0 28px 0;">
                We've reviewed your <strong>{{document_type}}</strong> for <strong>{{business_name}}</strong>, but unfortunately we weren't able to approve it at this time.
              </p>
              
              <!-- Reason Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%); border-radius: 12px; border-left: 4px solid #EF5350; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="36" valign="top">
                          <div style="width: 32px; height: 32px; background-color: #EF5350; border-radius: 50%; text-align: center; line-height: 32px; font-size: 16px; color: white;">!</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="color: #C62828; font-size: 14px; font-weight: 700; margin: 0 0 8px 0;">Reason</p>
                          <p style="color: #555555; font-size: 15px; margin: 0; line-height: 1.6;">{{rejection_reason}}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- What to do -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8faf9; border-radius: 12px; border: 1px solid #e8ebe9; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="color: #0B3D2E; font-size: 14px; font-weight: 600; margin: 0 0 10px 0;">📋 What to do next</p>
                    <p style="color: #666666; font-size: 14px; margin: 0; line-height: 1.6;">
                      Please log in to your account and upload a new document that addresses the issue mentioned above. Once submitted, our team will review it promptly.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 25px 0;">
                    <a href="{{verification_url}}" style="display: inline-block; background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(11, 61, 46, 0.3);">Upload New Document →</a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #888888; font-size: 13px; text-align: center; margin: 0; line-height: 1.5;">
                Need help? Reply to this email and we'll assist you.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0B3D2E; padding: 25px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0;">
                      You are receiving this because you submitted a verification document.<br>
                      © {{current_year}} Cleanda
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    name: "account_suspended",
    subject: "⚠️ Important: Your Cleanda Account Has Been Suspended",
    description: "Sent when a business account is suspended",
    variables: ["business_name", "contact_name", "suspension_reason", "support_email", "current_year"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f4f3; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0f4f3; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(11, 61, 46, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); padding: 35px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">✨ Cleanda</h1>
              <p style="color: #7DD3A8; margin: 6px 0 0 0; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Partner Network</p>
            </td>
          </tr>
          
          <!-- Alert Banner -->
          <tr>
            <td style="padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(90deg, #EF5350 0%, #E53935 100%);">
                <tr>
                  <td style="padding: 16px 40px; text-align: center;">
                    <span style="color: #ffffff; font-size: 15px; font-weight: 600;">⚠️ Account Suspended</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #333333; font-size: 17px; line-height: 1.6; margin: 0 0 25px 0;">
                Hi <strong>{{contact_name}}</strong>,
              </p>
              <p style="color: #555555; font-size: 16px; line-height: 1.7; margin: 0 0 28px 0;">
                We regret to inform you that your Cleanda partner account for <strong>{{business_name}}</strong> has been suspended.
              </p>
              
              <!-- Reason Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%); border-radius: 12px; border-left: 4px solid #EF5350; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="36" valign="top">
                          <div style="width: 32px; height: 32px; background-color: #EF5350; border-radius: 50%; text-align: center; line-height: 32px; font-size: 16px; color: white;">!</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="color: #C62828; font-size: 14px; font-weight: 700; margin: 0 0 8px 0;">Reason for Suspension</p>
                          <p style="color: #555555; font-size: 15px; margin: 0; line-height: 1.6;">{{suspension_reason}}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- What This Means -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8faf9; border-radius: 12px; border: 1px solid #e8ebe9; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="color: #0B3D2E; font-size: 14px; font-weight: 600; margin: 0 0 10px 0;">What this means</p>
                    <ul style="color: #666666; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
                      <li>You cannot unlock or purchase new leads</li>
                      <li>Your account dashboard is temporarily inaccessible</li>
                      <li>Any pending leads have been released</li>
                    </ul>
                  </td>
                </tr>
              </table>
              
              <p style="color: #555555; font-size: 15px; line-height: 1.7; margin: 0 0 10px 0;">
                If you believe this suspension was made in error or would like to discuss reinstatement, please contact our support team.
              </p>
              
              <p style="color: #888888; font-size: 13px; margin: 25px 0 0 0; line-height: 1.5;">
                Contact us at <a href="mailto:{{support_email}}" style="color: #0B3D2E; font-weight: 600;">{{support_email}}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f5f5f5; padding: 25px 40px; border-top: 1px solid #e8e8e8;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="color: #888888; font-size: 12px; margin: 0 0 8px 0;">
                      © {{current_year}} Cleanda · A trading name of Orbit Shade Ltd (Company No. 15337705)
                    </p>
                    <p style="color: #aaaaaa; font-size: 11px; margin: 0;">
                      128 City Road, London, EC1V 2NX
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
];

import { useAdmin } from "@/contexts/AdminContext";

export default function AdminEmailTemplates() {
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body: "",
    description: "",
    variables: "",
    is_active: true,
  });

  useEffect(() => {
    // Only fetch templates after confirming user is admin
    if (!adminLoading && isAdmin) {
      fetchTemplates();
    }
  }, [adminLoading, isAdmin]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("name");

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Failed to load email templates");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      description: template.description || "",
      variables: template.variables?.join(", ") || "",
      is_active: template.is_active,
    });
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setFormData({
      name: "",
      subject: "",
      body: "",
      description: "",
      variables: "",
      is_active: true,
    });
    setEditDialogOpen(true);
  };

  const handlePreview = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setPreviewDialogOpen(true);
  };

  const handleTestEmail = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setTestEmail("");
    setScheduledDate("");
    setScheduledTime("");
    setIsScheduling(false);
    setTestEmailDialogOpen(true);
  };

  const scheduleEmail = async () => {
    if (!selectedTemplate || !testEmail || !scheduledDate || !scheduledTime) return;

    setSendingTest(true);
    try {
      const html = getPreviewHtml(selectedTemplate);
      
      let subject = selectedTemplate.subject;
      const sampleData: Record<string, string> = {
        customer_name: "John Smith",
        business_name: "Sample Cleaning Co",
        contact_name: "Jane Doe",
        job_type: "End of Tenancy Clean",
        postcode: "SW1A 1AA",
        postcode_area: "SW1A",
        display_value: "from £150",
        reference_id: "TEST12345",
        preferred_date: "Monday, 15 January 2025",
        lead_date: "15 Jan 2025",
        current_year: new Date().getFullYear().toString(),
        dashboard_url: window.location.origin + "/dashboard",
        customer_phone: "07700 900123",
        customer_email: "john.smith@example.com",
        customer_address: "123 Sample Street, London",
        document_type: "Business Insurance",
        rejection_reason: "Document was unclear or expired. Please upload a clearer copy.",
        admin_notes: "All documents verified successfully.",
        verification_url: window.location.origin + "/verification",
        suspension_reason: "Multiple customer complaints and policy violations.",
        support_email: "support@cleanda.co.uk",
      };
      Object.entries(sampleData).forEach(([key, value]) => {
        subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
      });

      const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`);

      const { error } = await supabase
        .from("scheduled_emails")
        .insert({
          template_id: selectedTemplate.id,
          template_name: selectedTemplate.name,
          recipient_email: testEmail,
          subject: `[TEST] ${subject}`,
          html_body: html,
          scheduled_for: scheduledFor.toISOString(),
          is_test: true,
          created_by: user?.id,
        });

      if (error) throw error;

      toast.success(`Email scheduled for ${format(scheduledFor, "d MMM yyyy HH:mm")}`);
      setTestEmailDialogOpen(false);
    } catch (error: any) {
      console.error("Error scheduling email:", error);
      toast.error(error.message || "Failed to schedule email");
    } finally {
      setSendingTest(false);
    }
  };

  const sendTestEmail = async () => {
    if (!selectedTemplate || !testEmail) return;

    setSendingTest(true);
    try {
      // Prepare the email HTML with sample data
      const html = getPreviewHtml(selectedTemplate);
      
      // Replace variables in subject too
      let subject = selectedTemplate.subject;
      const sampleData: Record<string, string> = {
        customer_name: "John Smith",
        business_name: "Sample Cleaning Co",
        contact_name: "Jane Doe",
        job_type: "End of Tenancy Clean",
        postcode: "SW1A 1AA",
        postcode_area: "SW1A",
        display_value: "from £150",
        reference_id: "TEST12345",
        preferred_date: "Monday, 15 January 2025",
        lead_date: "15 Jan 2025",
        current_year: new Date().getFullYear().toString(),
        dashboard_url: window.location.origin + "/dashboard",
        customer_phone: "07700 900123",
        customer_email: "john.smith@example.com",
        customer_address: "123 Sample Street, London",
        document_type: "Business Insurance",
        rejection_reason: "Document was unclear or expired. Please upload a clearer copy.",
        admin_notes: "All documents verified successfully.",
        verification_url: window.location.origin + "/verification",
        suspension_reason: "Multiple customer complaints and policy violations.",
        support_email: "support@cleanda.co.uk",
      };
      Object.entries(sampleData).forEach(([key, value]) => {
        subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
      });

      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: testEmail,
          subject: `[TEST] ${subject}`,
          html: html,
          templateId: selectedTemplate.id,
          templateName: selectedTemplate.name,
          isTest: true,
        },
      });

      if (error) throw error;

      toast.success(`Test email sent to ${testEmail}`);
      setTestEmailDialogOpen(false);
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast.error(error.message || "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const variablesArray = formData.variables
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v);

      const templateData = {
        name: formData.name,
        subject: formData.subject,
        body: formData.body,
        description: formData.description || null,
        variables: variablesArray.length > 0 ? variablesArray : null,
        is_active: formData.is_active,
      };

      if (selectedTemplate) {
        const { error } = await supabase
          .from("email_templates")
          .update(templateData)
          .eq("id", selectedTemplate.id);

        if (error) throw error;
        toast.success("Template updated successfully");
      } else {
        const { error } = await supabase
          .from("email_templates")
          .insert(templateData);

        if (error) throw error;
        toast.success("Template created successfully");
      }

      setEditDialogOpen(false);
      fetchTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({ is_active: !template.is_active })
        .eq("id", template.id);

      if (error) throw error;
      toast.success(`Template ${!template.is_active ? "activated" : "deactivated"}`);
      fetchTemplates();
    } catch (error) {
      console.error("Error toggling template:", error);
      toast.error("Failed to update template");
    }
  };

  const seedDefaultTemplates = async () => {
    setSaving(true);
    try {
      for (const template of DEFAULT_TEMPLATES) {
        const { data: existing } = await supabase
          .from("email_templates")
          .select("id")
          .eq("name", template.name)
          .maybeSingle();

        if (existing) {
          // Update existing template with latest branding/content
          const { error } = await supabase
            .from("email_templates")
            .update({
              subject: template.subject,
              body: template.body,
              description: template.description,
              variables: template.variables,
            })
            .eq("id", existing.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("email_templates")
            .insert(template);

          if (error) throw error;
        }
      }
      toast.success("Templates updated with latest branding");
      fetchTemplates();
    } catch (error) {
      console.error("Error seeding templates:", error);
      toast.error("Failed to update templates");
    } finally {
      setSaving(false);
    }
  };

  // Replace variables with sample data for preview
  const getPreviewHtml = (template: EmailTemplate) => {
    const sampleData: Record<string, string> = {
      customer_name: "John Smith",
      business_name: "Sample Cleaning Co",
      contact_name: "Jane Doe",
      job_type: "End of Tenancy Clean",
      postcode: "SW1A 1AA",
      postcode_area: "SW1A",
      display_value: "from £150",
      reference_id: "ABC12345",
      preferred_date: "Monday, 15 January 2025",
      lead_date: "15 Jan 2025",
      current_year: new Date().getFullYear().toString(),
      dashboard_url: "#",
      customer_phone: "07700 900123",
      customer_email: "john.smith@example.com",
      customer_address: "123 Sample Street, London",
      document_type: "Business Insurance",
      rejection_reason: "Document was unclear or expired. Please upload a clearer copy.",
      admin_notes: "All documents verified successfully.",
      verification_url: "#",
      suspension_reason: "Multiple customer complaints and policy violations.",
      support_email: "support@cleanda.co.uk",
    };

    let html = template.body;
    Object.entries(sampleData).forEach(([key, value]) => {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    });
    return html;
  };

  return (
    <AdminLayout title="Email Templates">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email Templates</h1>
            <p className="text-muted-foreground">
              Customize email templates sent to customers and businesses
            </p>
          </div>
          <div className="flex gap-2">
            {templates.length === 0 && (
              <Button variant="outline" onClick={seedDefaultTemplates} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Default Templates
              </Button>
            )}
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>
        </div>

        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Scheduled
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Delivery Tracking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-6">
            {/* Templates Table */}
            <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Templates
            </CardTitle>
            <CardDescription>
              Use {"{{variable_name}}"} syntax to insert dynamic content
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-secondary" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No email templates yet</p>
                <Button onClick={seedDefaultTemplates} disabled={saving}>
                  Add Default Templates
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Variables</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          {template.description && (
                            <p className="text-xs text-muted-foreground">
                              {template.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {template.subject}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {template.variables?.slice(0, 3).map((v) => (
                            <Badge key={v} variant="secondary" className="text-xs">
                              {v}
                            </Badge>
                          ))}
                          {template.variables && template.variables.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{template.variables.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={template.is_active}
                          onCheckedChange={() => handleToggleActive(template)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(template.updated_at), "d MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(template)}
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTestEmail(template)}
                            title="Send Test Email"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(template)}
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Variable Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Variable className="w-5 h-5" />
              Variable Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="font-medium text-foreground">Customer</p>
                <ul className="text-muted-foreground space-y-1 mt-1">
                  <li><code className="bg-muted px-1 rounded">{"{{customer_name}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{customer_email}}"}</code></li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">Business</p>
                <ul className="text-muted-foreground space-y-1 mt-1">
                  <li><code className="bg-muted px-1 rounded">{"{{business_name}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{contact_name}}"}</code></li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">Lead</p>
                <ul className="text-muted-foreground space-y-1 mt-1">
                  <li><code className="bg-muted px-1 rounded">{"{{job_type}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{postcode}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{postcode_area}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{display_value}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{lead_date}}"}</code></li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">System</p>
                <ul className="text-muted-foreground space-y-1 mt-1">
                  <li><code className="bg-muted px-1 rounded">{"{{reference_id}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{current_year}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{dashboard_url}}"}</code></li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="scheduled">
            <ScheduledEmailsPanel />
          </TabsContent>

          <TabsContent value="logs">
            <EmailLogsPanel />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? "Edit Template" : "Create Template"}
            </DialogTitle>
            <DialogDescription>
              Customize the email template using HTML and variables
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., welcome_email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variables">Variables (comma-separated)</Label>
                <Input
                  id="variables"
                  value={formData.variables}
                  onChange={(e) =>
                    setFormData({ ...formData, variables: e.target.value })
                  }
                  placeholder="customer_name, job_type, postcode"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="When is this email sent?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                placeholder="Your Cleaning Request - Ref #{{reference_id}}"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body" className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                HTML Body
              </Label>
              <VariableAutocompleteTextarea
                value={formData.body}
                onChange={(value) =>
                  setFormData({ ...formData, body: value })
                }
                placeholder="<html>...</html>"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.name} - {selectedTemplate?.subject}
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="border rounded-lg overflow-hidden bg-white">
              <iframe
                srcDoc={getPreviewHtml(selectedTemplate)}
                className="w-full h-[500px]"
                title="Email Preview"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Test Email Dialog */}
      <Dialog open={testEmailDialogOpen} onOpenChange={setTestEmailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isScheduling ? <Calendar className="w-5 h-5" /> : <Send className="w-5 h-5" />}
              {isScheduling ? "Schedule Email" : "Send Test Email"}
            </DialogTitle>
            <DialogDescription>
              {isScheduling 
                ? "Select a template and schedule it to be sent at a specific time"
                : "Send a test email using sample data to verify the template looks correct"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Template Selector (for scheduling) */}
            {isScheduling && (
              <div className="space-y-2">
                <Label>Select Template</Label>
                <Select
                  value={selectedTemplate?.id || ""}
                  onValueChange={(value) => {
                    const template = templates.find(t => t.id === value);
                    setSelectedTemplate(template || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.filter(t => t.is_active).map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="test-email">Recipient Email</Label>
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="schedule-toggle"
                checked={isScheduling}
                onCheckedChange={setIsScheduling}
              />
              <Label htmlFor="schedule-toggle">Schedule for later</Label>
            </div>

            {isScheduling && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="schedule-date">Date</Label>
                  <Input
                    id="schedule-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule-time">Time</Label>
                  <Input
                    id="schedule-time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            {selectedTemplate && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">Template Details:</p>
                <p className="text-sm text-muted-foreground">
                  <strong>Name:</strong> {selectedTemplate.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Subject:</strong> {isScheduling ? "" : "[TEST] "}{selectedTemplate.subject}
                </p>
                {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Available Variables:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedTemplate.variables.map((v) => (
                        <Badge key={v} variant="secondary" className="text-xs">
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Variables will be replaced with sample data
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTestEmailDialogOpen(false)}>
                Cancel
              </Button>
              {isScheduling ? (
                <Button 
                  onClick={scheduleEmail} 
                  disabled={sendingTest || !testEmail || !scheduledDate || !scheduledTime || !selectedTemplate}
                >
                  {sendingTest && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule
                </Button>
              ) : (
                <Button 
                  onClick={sendTestEmail} 
                  disabled={sendingTest || !testEmail}
                >
                  {sendingTest && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Send Now
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
