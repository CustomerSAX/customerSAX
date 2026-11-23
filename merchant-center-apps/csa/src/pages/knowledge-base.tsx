import { useState } from 'react';
import CollapsiblePanel from '@commercetools-uikit/collapsible-panel';
import SelectField from '@commercetools-uikit/select-field';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import { ListPage } from '../components/common';

const FAQ = [
  {
    question: 'What does CSA provide for B2C support teams?',
    answer:
      'CSA brings customer, cart, order, return, payment, address, wishlist, promotion and custom-attribute context into one Merchant Center application.',
  },
  {
    question: 'Which project does CSA use?',
    answer:
      'CSA always uses the project selected in Merchant Center and the permissions of the logged-in Merchant Center user.',
  },
  {
    question: 'Can a customer profile be updated?',
    answer:
      'Yes. Open Customers, select a customer, and use Profile to update supported B2C customer fields. Updates use commercetools optimistic concurrency.',
  },
  {
    question: 'Can support agents manage a cart?',
    answer:
      'Agents with manage-order permissions can update line-item quantities, remove items, apply or remove discount codes, and place an active cart as an order.',
  },
  {
    question: 'Can an order or return be updated?',
    answer:
      'Agents with manage-order permissions can update order, payment and shipment states and create return information for eligible line items.',
  },
  {
    question: 'Does CSA share credentials with CustomerSAX?',
    answer:
      'No. CSA is independently built and deployed. It uses the logged-in Merchant Center session and never embeds commercetools client secrets in the browser.',
  },
];

const TROUBLESHOOTING = [
  {
    question: 'A customer cannot sign in',
    answer:
      'Confirm the customer is using the correct storefront and project. Verify the email address, then use the Password tab to issue an immediate B2C password reset when authorized.',
  },
  {
    question: 'A discount code cannot be applied',
    answer:
      'Confirm that the cart is Active, the code belongs to the selected project, its validity window is current, and its conditions match the cart. The commercetools validation message is shown in CSA.',
  },
  {
    question: 'A page shows a permission error',
    answer:
      'Ask an organization administrator to assign the corresponding CSA permission group to your Merchant Center team, then sign out and back in if permissions were just changed.',
  },
  {
    question: 'Tickets are unavailable',
    answer:
      'Tickets are not a native commercetools resource. A separately authenticated CSA ticket adapter must be configured before ticket data can be displayed.',
  },
  {
    question: 'The local app does not refresh files',
    answer:
      'If Watchpack reports EMFILE, stop the server, close unused development processes, raise the operating-system file descriptor limit, and restart CSA. Polling can be used as a temporary fallback.',
  },
];

const KnowledgeBase = () => {
  const [section, setSection] = useState<'faq' | 'troubleshooting'>('faq');
  const entries = section === 'faq' ? FAQ : TROUBLESHOOTING;
  return (
    <ListPage
      title="Knowledge Base"
      subtitle="B2C customer-service guidance and troubleshooting"
    >
      <Spacings.Stack scale="l">
        <SelectField
          name="knowledge-section"
          title="Section"
          value={section}
          options={[
            { value: 'faq', label: 'Frequently asked questions' },
            { value: 'troubleshooting', label: 'Troubleshooting' },
          ]}
          onChange={(event) =>
            setSection(event.target.value as 'faq' | 'troubleshooting')
          }
          horizontalConstraint={8}
        />
        <Text.Subheadline as="h4">
          {section === 'faq' ? 'Frequently asked questions' : 'Troubleshooting'}
        </Text.Subheadline>
        {entries.map((entry) => (
          <CollapsiblePanel
            key={entry.question}
            header={entry.question}
            isDefaultClosed
          >
            <Text.Body>{entry.answer}</Text.Body>
          </CollapsiblePanel>
        ))}
      </Spacings.Stack>
    </ListPage>
  );
};

KnowledgeBase.displayName = 'KnowledgeBase';
export default KnowledgeBase;
