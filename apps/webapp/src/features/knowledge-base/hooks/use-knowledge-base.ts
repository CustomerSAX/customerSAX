import type { KnowledgeBaseArticle } from "../types/knowledge-base-types";

export const FAQ_ARTICLES: KnowledgeBaseArticle[] = [
  {
    id: "faq-1",
    question: "What are the services do you offer?",
    answer:
      "We offer Multi-channel support (email, phone, chat, social media), Intelligent routing and prioritization of inquiries, Real-time analytics and performance metrics, Customizable automation and workflows and Omnichannel communication support.",
  },
  {
    id: "faq-2",
    question: "What are your preferred method of payment?",
    answer: "We preferred credit or debit card payment as well as UPI payments.",
  },
  {
    id: "faq-3",
    question: "Are your services beginners friendly?",
    answer:
      "Yes of course, our services are easy to understand and help customer service agents for multiple purposes.",
  },
  {
    id: "faq-4",
    question: "What how does it take to upgrade a package?",
    answer:
      "Upgrade is used to install the newest versions of all packages currently installed on the system from the sources enumerated in /etc/apt/sources.list.",
  },
  {
    id: "faq-5",
    question: "Where are your offices located around the world?",
    answer:
      "Headquartered in Chicago, Illinois we have a global footprint with offices and development centers across North America, Asia, Europe, Africa and the Middle east, India and Pakistan.",
  },
  {
    id: "faq-6",
    question: "What are the system requirements?",
    answer: "Information about hardware and software requirements are given on the System Requirements page.",
  },
  {
    id: "faq-7",
    question: "Can agents handle multiple tickets simultaneously?",
    answer:
      "Yes. Agents can manage multiple tickets at once. The system supports up to 20 concurrent tickets per agent with priority queuing.",
  },
  {
    id: "faq-8",
    question: "How do I export order data?",
    answer:
      "Navigate to the Orders page, apply filters as needed, then click the Export button in the top right corner to download as Excel or CSV.",
  },
];

export const TROUBLESHOOTING_ARTICLES: KnowledgeBaseArticle[] = [
  {
    id: "troubleshoot-1",
    question: "Customer not able to login",
    answer: "Step 1: Make sure they're using the correct URL\nStep 2: Check their credentials\nStep 3: Reset password",
  },
  {
    id: "troubleshoot-2",
    question: "How to add a discount code",
    answer:
      'After you add items to your cart:\nStep 1: At the bottom of the checkout screen, find "Add a discount code".\nStep 2: Enter your code.\nStep 3: Select Apply.',
  },
  {
    id: "troubleshoot-3",
    question: "App not responding",
    answer:
      "Step 1: Check Your Connection (and Other Sites)\nStep 2: See if the problem is on your end or theirs.\nStep 3: Browse a Cached Version of the Page\nStep 4: Disable Add-Ons and Other Interfering Software",
  },
  {
    id: "troubleshoot-4",
    question: "Payment failures",
    answer:
      "Step 1: Put Preventative Measures in Place to Avoid Failed Payments.\nStep 2: Make Sure You and the Customer Are Notified About Failed Payments\nStep 3: Work With the Customer and Payment Gateway to Retry the Payment",
  },
];
