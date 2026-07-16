const emailjsConfig = {
    PUBLIC_KEY: "sSbtAskJlw5QeAuYo",
    SERVICE_ID: "service_mey4u6n",
    TEMPLATE_ID: "template_qbhyykt"
};

// Initialize EmailJS when the DOM is ready and emailjs is available
document.addEventListener('DOMContentLoaded', () => {
    if (typeof emailjs !== 'undefined') {
        emailjs.init(emailjsConfig.PUBLIC_KEY);
    } else {
        console.warn("EmailJS SDK is not loaded.");
    }
});
