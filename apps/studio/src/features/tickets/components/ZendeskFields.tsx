"use client";

import { useQuery } from "@apollo/client";
import { SectionCard, InfoList, InfoRow, CardEmpty, SecondaryButton } from "@csa/ui";
import { TICKET_PROVIDER_FIELDS } from "../api/queries";

export function ZendeskFields({ id }: { id: string }) {
  const { data, loading, error, refetch } = useQuery<{
    ticketProviderFields: Array<{
      id: string;
      label: string;
      type: string;
      value: string | null;
    }>;
  }>(TICKET_PROVIDER_FIELDS, { variables: { id }, fetchPolicy: "network-only" });
  return (
    <SectionCard
      title="Zendesk Fields"
      icon="tag"
      action={
        <SecondaryButton
          onClick={() => {
            void refetch();
          }}
          disabled={loading}
        >
          Refresh
        </SecondaryButton>
      }
    >
      {error ? (
        <CardEmpty
          icon="alert-triangle"
          title="Unable to load Zendesk fields"
          hint={error.message}
        />
      ) : loading && !data ? (
        <CardEmpty icon="loader" title="Loading Zendesk fields…" />
      ) : (
        <>
          <p className="mb-4 text-[12px] text-m-text-muted">
            Values from Zendesk. Edit these fields in Zendesk, then refresh.
          </p>
          <InfoList>
            {data?.ticketProviderFields.map((field) => (
              <InfoRow
                key={field.id}
                label={field.label}
                value={field.value ?? undefined}
              />
            ))}
          </InfoList>
        </>
      )}
    </SectionCard>
  );
}
