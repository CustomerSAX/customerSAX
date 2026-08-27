"use client";

import { Button, FormField } from "@csa/ui";
import { SectionCard, PrimaryButton, CardEmpty } from "@csa/ui";
import type { OrderCommentsTabProps } from "./order-tab-types";

export function OrderCommentsTab(props: OrderCommentsTabProps) {
  const {
    order, fmtDate, showCommentForm, setShowCommentForm,
    commentInput, setCommentInput, handleAddComment,
  } = props;

  return (
        <div className="flex flex-col gap-5">
          <div className="flex justify-end">
            <PrimaryButton icon={showCommentForm ? "x" : "plus"} onClick={() => setShowCommentForm(!showCommentForm)}>
              {showCommentForm ? "Cancel Comment" : "Add Comment"}
            </PrimaryButton>
          </div>

          {showCommentForm && (
            <SectionCard title="Add New Order Comment" icon="message-square">
              <div className="space-y-3">
                <FormField>
                  <textarea
                    className="w-full p-3 border border-m-border rounded-m-md text-xs text-m-text bg-transparent focus:outline-none focus:ring-1 focus:ring-m-primary"
                    rows={3}
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Add internal order note or customer service update..."
                  />
                </FormField>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="primary" size="md" onClick={handleAddComment}>
                    Submit Comment
                  </Button>
                  <Button type="button" variant="secondary" size="md" onClick={() => setShowCommentForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard title={`Order Notes & History (${order.comments?.length || 0})`} icon="message-square">
            {order.comments && order.comments.length > 0 ? (
              <div className="space-y-3">
                {order.comments.map((c) => (
                  <div key={c.id} className="p-3 bg-m-surface-2 border border-m-border rounded-m-md text-xs space-y-1">
                    <div className="flex items-center justify-between text-m-text-muted">
                      <span className="font-bold text-m-text">{c.author}</span>
                      <span>{fmtDate(c.createdAt)}</span>
                    </div>
                    <p className="text-m-text leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <CardEmpty
                icon="message-square"
                title="No comments yet"
                hint="There are no comments attached to this order yet."
              />
            )}
          </SectionCard>
        </div>
  );
}
