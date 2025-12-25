export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: BlogCategory;
  author: string;
  publishedAt: string;
  readingTime: number;
  featuredImage?: string;
  metaDescription: string;
  keywords: string[];
}

export type BlogCategory = 
  | "deep-cleaning"
  | "carpet-care"
  | "end-of-tenancy"
  | "upholstery"
  | "tips-tricks"
  | "commercial";

export const categoryLabels: Record<BlogCategory, string> = {
  "deep-cleaning": "Deep Cleaning",
  "carpet-care": "Carpet Care",
  "end-of-tenancy": "End of Tenancy",
  "upholstery": "Upholstery",
  "tips-tricks": "Tips & Tricks",
  "commercial": "Commercial Cleaning",
};

export const categoryColors: Record<BlogCategory, string> = {
  "deep-cleaning": "bg-emerald-100 text-emerald-700",
  "carpet-care": "bg-amber-100 text-amber-700",
  "end-of-tenancy": "bg-indigo-100 text-indigo-700",
  "upholstery": "bg-rose-100 text-rose-700",
  "tips-tricks": "bg-sky-100 text-sky-700",
  "commercial": "bg-slate-100 text-slate-700",
};

export const blogPosts: BlogPost[] = [
  {
    id: "1",
    slug: "ultimate-guide-deep-cleaning-your-home",
    title: "The Ultimate Guide to Deep Cleaning Your Home",
    excerpt: "Learn professional deep cleaning techniques that will transform your living space. From room-by-room strategies to essential tools, this comprehensive guide covers everything.",
    content: `
## Why Deep Cleaning Matters

Regular cleaning keeps your home tidy, but deep cleaning tackles the dirt and grime that accumulates over time in hard-to-reach places. A thorough deep clean every 3-6 months can improve air quality, extend the life of your furnishings, and create a healthier living environment.

## Room-by-Room Deep Cleaning Checklist

### Kitchen
The kitchen requires extra attention due to grease buildup and food particles:

- **Behind appliances**: Pull out the fridge, oven, and dishwasher to clean accumulated dust and debris
- **Inside cabinets**: Empty all cabinets, wipe down shelves, and check for expired items
- **Extractor hood and filters**: Soak filters in hot soapy water and degrease the hood
- **Oven interior**: Use a dedicated oven cleaner or a paste of bicarbonate of soda and water
- **Sink and drains**: Use a drain cleaner and scrub the sink with a mild abrasive

### Bathroom
Bathrooms harbour bacteria and require thorough disinfection:

- **Grout and tile**: Apply a grout cleaner and scrub with a stiff brush
- **Shower head**: Soak in white vinegar overnight to remove limescale
- **Behind the toilet**: Often neglected, this area needs regular attention
- **Medicine cabinet**: Check expiry dates and organise contents
- **Exhaust fan**: Remove the cover and vacuum dust buildup

### Bedrooms
Focus on areas that affect sleep quality and air:

- **Mattress**: Vacuum thoroughly and treat stains with an enzyme cleaner
- **Under the bed**: Clear out dust bunnies and forgotten items
- **Wardrobe interiors**: Wipe shelves and consider adding cedar blocks
- **Curtains and blinds**: Wash curtains and dust blinds thoroughly
- **Light fixtures**: Remove and wash glass covers

### Living Areas
High-traffic areas need extra care:

- **Upholstery**: Vacuum sofas using the upholstery attachment
- **Skirting boards**: Wipe down with a damp cloth
- **Door frames and handles**: Often touched but rarely cleaned
- **Electronics**: Dust TV screens, game consoles, and remotes
- **Bookshelves**: Remove books and dust each shelf

## Essential Deep Cleaning Tools

Invest in quality tools for better results:

1. **Microfibre cloths**: More effective than cotton at trapping dirt
2. **Extension duster**: For ceiling fans and high corners
3. **Grout brush**: Essential for tile and grout cleaning
4. **Steam cleaner**: Great for sanitising without chemicals
5. **Vacuum with attachments**: Crevice tool and upholstery brush are essential

## When to Hire a Professional

While DIY deep cleaning is rewarding, some tasks benefit from professional expertise:

- Post-renovation cleaning
- Move-in or move-out cleans
- Homes with persistent odours
- Properties that haven't been deep cleaned in years

Professional cleaners have commercial-grade equipment and products that can achieve results difficult to match at home.
    `,
    category: "deep-cleaning",
    author: "Deep Clean UK",
    publishedAt: "2025-01-15",
    readingTime: 8,
    metaDescription: "Complete guide to deep cleaning your home room by room. Learn professional techniques, essential tools, and when to hire experts for the best results.",
    keywords: ["deep cleaning", "home cleaning guide", "professional cleaning tips", "room by room cleaning"],
  },
  {
    id: "2",
    slug: "how-to-remove-carpet-stains",
    title: "How to Remove Common Carpet Stains: A Complete Guide",
    excerpt: "From red wine to pet accidents, learn how to tackle the most common carpet stains with household items and professional techniques.",
    content: `
## Act Fast for Best Results

The golden rule of carpet stain removal is speed. The longer a stain sits, the deeper it penetrates the carpet fibres and the harder it becomes to remove. Keep a basic stain removal kit handy so you can act immediately.

## The Golden Rules of Carpet Stain Removal

Before tackling any stain, remember these principles:

1. **Blot, don't rub**: Rubbing spreads the stain and damages carpet fibres
2. **Work from outside in**: Prevents the stain from spreading
3. **Test first**: Always test cleaning solutions on a hidden area
4. **Use cold water**: Hot water can set protein-based stains
5. **Be patient**: Some stains need multiple treatments

## Common Stain Removal Methods

### Red Wine
One of the most feared stains, but very treatable if caught early:

1. Blot up as much wine as possible
2. Cover with salt or bicarbonate of soda to absorb moisture
3. After 5 minutes, vacuum up the powder
4. Mix one tablespoon of washing-up liquid with one tablespoon of white vinegar and 500ml warm water
5. Apply to the stain and blot with a clean cloth
6. Rinse with cold water and blot dry

### Coffee and Tea
Tannin-based stains respond well to this method:

1. Blot up excess liquid immediately
2. Mix one tablespoon of white vinegar with one tablespoon of washing-up liquid and 500ml warm water
3. Apply to the stain and let sit for 10 minutes
4. Blot with a clean, damp cloth
5. Repeat if necessary

### Pet Accidents
Enzyme cleaners are essential for pet stains:

1. Blot up as much as possible with paper towels
2. Apply an enzyme-based pet stain remover (available at pet shops)
3. Cover with a damp cloth and leave for 24 hours
4. Vacuum when dry
5. For old stains, you may need professional treatment

### Grease and Oil
These require a different approach:

1. Sprinkle cornstarch or bicarbonate of soda on the stain
2. Leave for 15 minutes to absorb the grease
3. Vacuum thoroughly
4. Apply a small amount of washing-up liquid directly to the stain
5. Blot with warm water until clean

### Ink
Act immediately for best results:

1. Dab (don't rub) with rubbing alcohol on a clean cloth
2. Blot with a dry cloth
3. Repeat until no more ink transfers
4. Rinse with cold water

## When Professional Carpet Cleaning is Needed

Some situations call for professional intervention:

- **Large area stains**: Spills covering more than a small area
- **Set-in stains**: Old stains that have been there for weeks
- **Delicate carpets**: Wool, silk, or antique rugs
- **Unknown substances**: When you're not sure what caused the stain
- **Recurring stains**: Stains that keep coming back after cleaning

Professional carpet cleaners use hot water extraction and commercial-grade products that can remove stains impossible to treat at home.

## Prevention Tips

- Remove shoes at the door
- Treat carpets with a stain-resistant spray
- Clean up spills immediately
- Use doormats at all entrances
- Schedule regular professional cleaning every 12-18 months
    `,
    category: "carpet-care",
    author: "Deep Clean UK",
    publishedAt: "2025-01-10",
    readingTime: 6,
    metaDescription: "Learn how to remove red wine, coffee, pet stains and more from carpets. Expert tips for DIY stain removal and when to call professional carpet cleaners.",
    keywords: ["carpet stain removal", "remove wine stains", "pet stain carpet", "carpet cleaning tips"],
  },
  {
    id: "3",
    slug: "end-of-tenancy-cleaning-checklist",
    title: "End of Tenancy Cleaning Checklist: Get Your Deposit Back",
    excerpt: "A comprehensive room-by-room checklist to ensure your rental property meets landlord standards and you get your full deposit returned.",
    content: `
## Why End of Tenancy Cleaning Matters

Your deposit is typically equivalent to 4-6 weeks' rent—a significant sum worth protecting. Landlords and letting agents scrutinise properties at check-out, and cleaning is the most common reason for deposit deductions.

## Understanding Landlord Expectations

Most tenancy agreements require you to return the property in the same condition it was at check-in, minus reasonable wear and tear. Key things landlords look for:

- Professional-level cleanliness
- No damage beyond normal wear
- All items working properly
- Garden maintained (if applicable)

## Complete End of Tenancy Cleaning Checklist

### Kitchen (Most Scrutinised Area)

**Appliances:**
- [ ] Oven cleaned inside and out, including racks and trays
- [ ] Hob degreased and all burner parts cleaned
- [ ] Extractor hood and filters cleaned
- [ ] Fridge and freezer defrosted and cleaned
- [ ] Dishwasher filter cleaned, interior wiped
- [ ] Microwave interior and exterior cleaned
- [ ] Washing machine drum cleaned, filter checked

**Surfaces and Storage:**
- [ ] All worktops cleaned and sanitised
- [ ] Inside all cupboards wiped clean
- [ ] Drawer fronts and handles cleaned
- [ ] Splashbacks degreased
- [ ] Sink and taps descaled and polished

**Other:**
- [ ] Light fixtures cleaned
- [ ] Windows inside and out
- [ ] Floor thoroughly cleaned
- [ ] Bins emptied and cleaned

### Bathroom(s)

**Fixtures:**
- [ ] Toilet cleaned inside, outside, and behind
- [ ] Bath/shower scrubbed and free of limescale
- [ ] Shower screen or curtain cleaned/replaced
- [ ] Taps descaled and polished
- [ ] Sink cleaned inside and underneath

**Other:**
- [ ] All tiles and grout cleaned
- [ ] Extractor fan dust-free
- [ ] Mirror streak-free
- [ ] Floor cleaned including corners
- [ ] Towel rails and accessories cleaned

### Bedrooms

- [ ] Wardrobes emptied and wiped inside
- [ ] Drawers cleaned inside
- [ ] All surfaces dusted
- [ ] Light fixtures and switches cleaned
- [ ] Windows cleaned inside and out
- [ ] Carpets vacuumed and shampooed if needed
- [ ] Skirting boards wiped

### Living Areas

- [ ] All surfaces dusted and polished
- [ ] Light fixtures cleaned
- [ ] Windows inside and out
- [ ] Carpets/floors professionally cleaned
- [ ] Fireplaces cleaned (if applicable)
- [ ] Skirting boards and door frames wiped

### Hallways and Stairs

- [ ] Entrance area thoroughly cleaned
- [ ] Bannisters and handrails wiped
- [ ] Stairs vacuumed
- [ ] Light switches and door handles cleaned
- [ ] Cupboards emptied and cleaned

### Exterior and Garden

- [ ] Paths swept
- [ ] Lawn mowed
- [ ] Weeds removed
- [ ] Bins emptied and cleaned
- [ ] Shed/garage cleared and cleaned
- [ ] External windows cleaned

## Professional vs DIY End of Tenancy Cleaning

**Consider DIY if:**
- You have time (allow 1-2 full days)
- The property is small and well-maintained
- You have professional-grade cleaning products

**Hire professionals if:**
- Time is limited
- Oven or carpets need significant work
- You want a guarantee for your deposit
- The inventory check is strict

## Tips for a Successful Check-Out

1. **Request the inventory early**: Compare current state to check-in report
2. **Take photos**: Document the property's condition
3. **Keep receipts**: Professional cleaning receipts support your case
4. **Report issues in writing**: Any problems should be documented
5. **Attend the check-out**: Be present to discuss any concerns
    `,
    category: "end-of-tenancy",
    author: "Deep Clean UK",
    publishedAt: "2025-01-05",
    readingTime: 7,
    metaDescription: "Complete end of tenancy cleaning checklist to help you get your deposit back. Room-by-room guide with landlord expectations and professional tips.",
    keywords: ["end of tenancy cleaning", "deposit back", "rental cleaning checklist", "move out cleaning"],
  },
  {
    id: "4",
    slug: "how-to-clean-sofa-upholstery",
    title: "How to Clean Your Sofa and Upholstery Like a Pro",
    excerpt: "Professional techniques for cleaning fabric and leather sofas at home, plus when to call in the experts for stubborn stains and odours.",
    content: `
## Understanding Your Upholstery

Before cleaning any upholstery, check the care label. Look for these codes:

- **W**: Water-based cleaner safe
- **S**: Solvent-based cleaner only (no water)
- **WS**: Either water or solvent-based cleaners
- **X**: Vacuum only, no cleaners

Using the wrong type of cleaner can permanently damage fabric.

## Regular Maintenance for Longer Life

Weekly care prevents major cleaning needs:

1. **Vacuum weekly** using the upholstery attachment
2. **Flip cushions** to distribute wear evenly
3. **Plump cushions** daily to maintain shape
4. **Keep out of direct sunlight** to prevent fading
5. **Address spills immediately** before they set

## Cleaning Fabric Sofas

### General Cleaning Method

1. Vacuum the entire sofa thoroughly, including under cushions
2. Mix a solution of warm water with a few drops of washing-up liquid
3. Test on a hidden area first
4. Dip a microfibre cloth in the solution and wring until barely damp
5. Wipe the fabric in straight lines, working in sections
6. Use a clean, damp cloth to remove soap residue
7. Allow to air dry completely (use fans to speed up)

### Dealing with Odours

Sofas absorb smells from pets, food, and everyday use:

1. Sprinkle bicarbonate of soda liberally over the fabric
2. Leave for at least 15 minutes (overnight for stubborn odours)
3. Vacuum thoroughly
4. Repeat if necessary

For persistent odours, an enzyme cleaner may be needed.

## Cleaning Leather Sofas

Leather requires different care than fabric:

### Regular Cleaning

1. Dust weekly with a soft, dry cloth
2. Vacuum crevices gently with a soft brush attachment
3. Wipe with a damp cloth monthly
4. Apply leather conditioner every 6-12 months

### Cleaning Spills

1. Blot immediately with a dry cloth
2. For sticky residue, use a slightly damp cloth
3. Dry immediately with a clean cloth
4. Never use harsh chemicals or abrasive cleaners

### Conditioning

Leather dries out over time and can crack without conditioning:

1. Clean the leather first
2. Apply a leather conditioner with a soft cloth
3. Allow to absorb for 10-15 minutes
4. Buff with a clean, dry cloth

## Common Upholstery Stains

### Food and Drink
1. Blot excess immediately
2. Apply a fabric cleaner or water-based solution
3. Blot until clean
4. Rinse and dry

### Ink
1. Dab with rubbing alcohol on a cotton ball
2. Blot, don't rub
3. Work from outside in
4. May require professional treatment

### Pet Hair
1. Use a rubber glove and run your hand over the fabric
2. The hair will clump together for easy removal
3. Follow with vacuuming
4. Consider a fabric protector spray

## When to Call Professionals

Professional upholstery cleaning is recommended:

- Once every 1-2 years for regular maintenance
- After significant staining
- For delicate or antique fabrics
- Before selling furniture
- If home methods haven't worked

Professional cleaners use hot water extraction and specialised products that achieve deeper cleaning than home methods.
    `,
    category: "upholstery",
    author: "Deep Clean UK",
    publishedAt: "2024-12-28",
    readingTime: 6,
    metaDescription: "Learn how to clean fabric and leather sofas at home. Professional upholstery cleaning tips, stain removal methods, and maintenance advice.",
    keywords: ["sofa cleaning", "upholstery cleaning", "leather sofa care", "fabric sofa stains"],
  },
  {
    id: "5",
    slug: "spring-cleaning-tips-uk",
    title: "10 Essential Spring Cleaning Tips for UK Homes",
    excerpt: "Make the most of the new season with these practical spring cleaning tips tailored for British homes and weather conditions.",
    content: `
## Why Spring Cleaning Matters

After months of closed windows and heating, UK homes need a thorough refresh. Spring cleaning isn't just tradition—it improves indoor air quality, reduces allergens before hay fever season, and gives your home a fresh start.

## 10 Essential Spring Cleaning Tips

### 1. Start with Decluttering

Before cleaning, remove items you no longer need:

- Sort through winter clothes and donate what you won't wear
- Clear out kitchen cupboards of expired items
- Tackle the "junk drawer" and be ruthless
- Book a charity collection for larger items

A decluttered home is easier to clean and maintain.

### 2. Clean Windows Inside and Out

British winters leave windows grimy. Choose a dry, overcast day (direct sun causes streaking):

- Remove window screens and wash in soapy water
- Mix equal parts water and white vinegar for streak-free glass
- Use a squeegee for best results
- Don't forget window sills and tracks

### 3. Deep Clean Soft Furnishings

Carpets, rugs, and upholstery trap winter dust:

- Steam clean carpets or hire a professional
- Wash all cushion covers and throws
- Air out mattresses and pillows
- Consider replacing pillows if over 2 years old

### 4. Tackle the Kitchen Thoroughly

The kitchen needs extra attention:

- Pull out appliances and clean behind them
- Degrease the extractor hood and filters
- Deep clean the oven (or book a professional)
- Empty and clean the fridge and freezer
- Wash inside all cupboards

### 5. Freshen Up the Bathroom

Prevent mould and mildew buildup:

- Reseal around the bath and shower if needed
- Deep clean tile grout
- Descale shower heads with vinegar
- Wash or replace shower curtains
- Clean the extractor fan

### 6. Address Dust Hotspots

Focus on overlooked areas:

- Ceiling fans and light fixtures
- Top of wardrobes and kitchen cabinets
- Behind radiators
- Skirting boards
- Door frames and architraves

### 7. Organise Storage Spaces

Clear out what's accumulated over winter:

- Loft and garage clear-out
- Under-stairs cupboard organisation
- Shed and garden storage
- Coat cupboards and hallway storage

### 8. Refresh Bedding and Textiles

After a winter of closed windows:

- Wash all duvets and pillows (or professional clean if too large)
- Clean mattress protectors
- Wash curtains or have them dry cleaned
- Air out winter bedding before storage

### 9. Clean Exterior Areas

Prepare for warmer months:

- Sweep patios and pathways
- Clean outdoor furniture
- Clear gutters of winter debris
- Wash external windows
- Tidy the garden

### 10. Create a Maintenance Schedule

Keep the freshness going:

- Set weekly, monthly, and quarterly cleaning tasks
- Create a family cleaning rota
- Schedule professional cleans for carpets and ovens
- Set reminders for seasonal tasks

## The Benefits of Professional Spring Cleaning

While DIY spring cleaning is rewarding, professionals can tackle:

- Deep carpet and upholstery cleaning
- Oven cleaning
- Window cleaning (especially upper floors)
- Post-winter garden clearance

Consider booking professionals for the big tasks and focus your energy on organisation and decluttering.

## Spring Cleaning Checklist

Download our printable checklist covering every room in your home, or use our quote system to find a professional cleaner in your area.
    `,
    category: "tips-tricks",
    author: "Deep Clean UK",
    publishedAt: "2024-12-20",
    readingTime: 5,
    metaDescription: "10 essential spring cleaning tips for UK homes. Practical advice for tackling every room, from decluttering to deep cleaning, tailored for British weather.",
    keywords: ["spring cleaning tips", "UK cleaning guide", "seasonal cleaning", "home cleaning checklist"],
  },
  {
    id: "6",
    slug: "office-cleaning-best-practices",
    title: "Office Cleaning Best Practices: A Guide for UK Businesses",
    excerpt: "Maintain a healthy, productive workplace with these commercial cleaning standards and tips for UK offices.",
    content: `
## Why Office Cleaning Matters

A clean office isn't just about appearances. Research shows that workplace cleanliness affects:

- **Employee health**: Fewer sick days
- **Productivity**: Clean environments improve focus
- **Professional image**: First impressions matter
- **Staff morale**: People work better in pleasant surroundings

## Daily Cleaning Essentials

Every office needs these tasks completed daily:

### Reception and Common Areas
- Empty all bins
- Vacuum or mop floors
- Wipe down surfaces and door handles
- Clean windows and glass doors
- Dust reception desk

### Kitchen and Break Room
- Clean all surfaces and appliances
- Empty bins and replace liners
- Clean sink and taps
- Wipe tables and chairs
- Stock supplies (soap, paper towels)

### Toilets
- Clean and disinfect all fixtures
- Mop floors
- Restock supplies
- Empty bins
- Check for maintenance issues

### Workspaces
- Empty desk bins
- Vacuum open areas
- Clean shared equipment (printers, phones)

## Weekly Deep Cleaning Tasks

In addition to daily cleaning:

- Dust all surfaces including shelving
- Clean computer screens and keyboards
- Vacuum under desks and furniture
- Clean interior windows
- Sanitise door handles and light switches
- Deep clean kitchen appliances

## Monthly and Quarterly Tasks

Schedule these for thorough maintenance:

### Monthly
- Deep clean carpets in high-traffic areas
- Clean blinds and window treatments
- Dust ceiling vents and fixtures
- Polish wooden furniture
- Clean exterior windows (ground floor)

### Quarterly
- Professional carpet cleaning
- Deep clean upholstery
- High-level dusting
- Air conditioning filter cleaning
- Full window cleaning including upper floors

## Health and Safety Considerations

UK workplaces must meet certain standards:

- **COSHH compliance**: Proper storage and use of cleaning chemicals
- **Risk assessments**: Identify hazards from cleaning activities
- **Training**: Staff must be properly trained
- **PPE**: Appropriate protective equipment provided
- **Documentation**: Maintain cleaning records

## Choosing a Commercial Cleaning Service

Look for these qualities:

1. **Insurance**: Public liability and employer's liability
2. **References**: Check reviews and ask for references
3. **Training**: Staff should be properly trained
4. **Flexibility**: Can adapt to your schedule
5. **Communication**: Clear point of contact
6. **Environmental practices**: Eco-friendly options

## Cost Considerations

Commercial cleaning costs depend on:

- Size of premises
- Frequency of cleaning
- Services required
- Location
- Access requirements (out of hours, security)

Most commercial cleaners charge per hour or offer fixed monthly contracts. Request multiple quotes and compare what's included.

## COVID-19 and Enhanced Cleaning

Post-pandemic, many offices maintain enhanced cleaning:

- Increased focus on high-touch surfaces
- Hand sanitiser stations
- Regular deep cleaning
- Air purification consideration
- Staff awareness training

## Creating a Cleaning Specification

Document your requirements:

1. List all areas to be cleaned
2. Specify frequency for each task
3. Include any special requirements
4. Define quality standards
5. Set communication expectations
6. Outline security and access procedures

A clear specification helps cleaners meet your expectations and provides a basis for monitoring performance.
    `,
    category: "commercial",
    author: "Deep Clean UK",
    publishedAt: "2024-12-15",
    readingTime: 7,
    metaDescription: "Office cleaning best practices for UK businesses. Daily, weekly and monthly cleaning schedules, health and safety compliance, and hiring commercial cleaners.",
    keywords: ["office cleaning", "commercial cleaning UK", "workplace cleaning", "business cleaning standards"],
  },
];

export const getPostBySlug = (slug: string): BlogPost | undefined => {
  return blogPosts.find(post => post.slug === slug);
};

export const getRelatedPosts = (currentPost: BlogPost, limit: number = 3): BlogPost[] => {
  return blogPosts
    .filter(post => post.id !== currentPost.id)
    .filter(post => post.category === currentPost.category || 
      post.keywords.some(kw => currentPost.keywords.includes(kw)))
    .slice(0, limit);
};

export const getPostsByCategory = (category: BlogCategory): BlogPost[] => {
  return blogPosts.filter(post => post.category === category);
};

export const getAllCategories = (): BlogCategory[] => {
  return [...new Set(blogPosts.map(post => post.category))];
};
