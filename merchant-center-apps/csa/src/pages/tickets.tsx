import { InfoMainPage } from '@commercetools-frontend/application-components';
import { ContentNotification } from '@commercetools-uikit/notifications';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';

const Tickets = () => (
  <InfoMainPage
    title="Tickets"
    subtitle="Customer-service tickets associated with this project"
  >
    <Spacings.Stack scale="l">
      <ContentNotification type="info">
        <Text.Body>
          The commercetools project does not provide a native ticket resource.
          Configure the standalone CSA ticket adapter through Merchant Center’s
          secure proxy to display ticket data here.
        </Text.Body>
      </ContentNotification>
      <Text.Body>
        No ticket data is fabricated or read from the CustomerSAX runtime.
      </Text.Body>
    </Spacings.Stack>
  </InfoMainPage>
);

Tickets.displayName = 'Tickets';
export default Tickets;
