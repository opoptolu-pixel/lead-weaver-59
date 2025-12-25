// Google Analytics 4 Event Tracking Utility

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// Core gtag function wrapper
export const gtag = (...args: unknown[]) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag(...args);
  }
};

// Track custom events
export const trackEvent = (
  eventName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters?: Record<string, any>
) => {
  gtag('event', eventName, parameters);
};

// ============================================
// CONVERSION EVENTS
// ============================================

// Track when a cleaning request form is submitted (primary conversion)
export const trackCleaningRequest = (params: {
  jobType: string;
  postcode: string;
  estimatedValue?: string;
}) => {
  trackEvent('generate_lead', {
    currency: 'GBP',
    value: parseFloat(params.estimatedValue?.replace(/[^0-9.]/g, '') || '100'),
    lead_source: 'cleaning_request_form',
    job_type: params.jobType,
    postcode_area: params.postcode.split(' ')[0]?.toUpperCase() || params.postcode,
  });
  
  // Also track as a custom conversion event
  trackEvent('cleaning_request_submitted', {
    job_type: params.jobType,
    postcode_area: params.postcode.split(' ')[0]?.toUpperCase() || params.postcode,
    estimated_value: params.estimatedValue || 'not_specified',
  });
};

// Track enquiries (contact form & business enquiries - NOT leads)
export const trackEnquiry = (params: {
  source: 'contact_form' | 'business_enquiry';
  subject?: string;
}) => {
  trackEvent('enquiry', {
    enquiry_source: params.source,
    subject_category: params.subject?.slice(0, 50) || 'general',
  });
};

// Track cleaner registration/signup
export const trackCleanerSignup = () => {
  trackEvent('sign_up', {
    method: 'email',
    user_type: 'cleaner',
  });
};

// Track lead unlock (cleaner purchased a lead)
export const trackLeadUnlock = (params: {
  leadValue: number;
  jobType: string;
}) => {
  trackEvent('purchase', {
    currency: 'GBP',
    value: params.leadValue,
    transaction_id: `lead_${Date.now()}`,
    items: [{
      item_name: 'Lead Unlock',
      item_category: params.jobType,
      price: params.leadValue,
      quantity: 1,
    }],
  });
};

// Track credit purchase
export const trackCreditPurchase = (params: {
  amount: number;
  credits: number;
}) => {
  trackEvent('purchase', {
    currency: 'GBP',
    value: params.amount,
    transaction_id: `credits_${Date.now()}`,
    items: [{
      item_name: 'Credits',
      quantity: params.credits,
      price: params.amount / params.credits,
    }],
  });
};

// ============================================
// ENGAGEMENT EVENTS
// ============================================

// Track form step progression
export const trackFormStep = (params: {
  formName: string;
  stepNumber: number;
  stepName: string;
}) => {
  trackEvent('form_step', {
    form_name: params.formName,
    step_number: params.stepNumber,
    step_name: params.stepName,
  });
};

// Track page/section views
export const trackPageView = (pagePath: string, pageTitle: string) => {
  gtag('config', 'G-DECLEHV54G', {
    page_path: pagePath,
    page_title: pageTitle,
  });
};

// Track CTA button clicks
export const trackCTAClick = (ctaName: string, ctaLocation: string) => {
  trackEvent('cta_click', {
    cta_name: ctaName,
    cta_location: ctaLocation,
  });
};

// Track phone number clicks
export const trackPhoneClick = () => {
  trackEvent('click', {
    event_category: 'contact',
    event_label: 'phone_call',
  });
};

// Track email clicks
export const trackEmailClick = () => {
  trackEvent('click', {
    event_category: 'contact',
    event_label: 'email',
  });
};
