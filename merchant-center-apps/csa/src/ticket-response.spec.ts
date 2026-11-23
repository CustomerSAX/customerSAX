import { ticketFromDetailResponse } from './ticket-response';

const ticket = {
  id: '6b045eb4abda06918c5f1086',
  ticketNumber: 'CSA-20261123-00103',
  subject: 'Update my phone number',
};

describe('ticketFromDetailResponse', () => {
  it('reads a direct ticket response', () => {
    expect(ticketFromDetailResponse(ticket, ticket.id)).toEqual(ticket);
  });

  it('reads an enveloped ticket response', () => {
    expect(ticketFromDetailResponse({ data: { ticket } }, ticket.id)).toEqual(
      ticket
    );
  });

  it('finds the selected ticket in a legacy list response', () => {
    expect(
      ticketFromDetailResponse(
        {
          results: [{ id: 'another-id', ticketNumber: 'CSA-OTHER' }, ticket],
        },
        ticket.id
      )
    ).toEqual(ticket);
  });

  it('rejects a list response without the selected ticket', () => {
    expect(
      ticketFromDetailResponse(
        { results: [{ id: 'another-id', ticketNumber: 'CSA-OTHER' }] },
        ticket.id
      )
    ).toBeUndefined();
  });
});
