"use client";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import allLocales from "@fullcalendar/core/locales-all";
import type { EventDropArg, EventInput } from "@fullcalendar/core";
import { Button, Icon, Modal } from "@csa/ui";
import { useLocale, useNow, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSubscriptions } from "../subscriptions/hooks/use-subscriptions";
import type {
  CustomerSubscription,
  SubscriptionFrequency
} from "../subscriptions/types/subscription-types";

type VisibleRange = {
  start: Date;
  end: Date;
};

type SubscriptionCalendarEvent = Omit<EventInput, "start" | "end" | "extendedProps"> & {
  start: Date;
  end: Date;
  extendedProps: {
    subscription: CustomerSubscription;
    sequence: number;
  };
};

function parseLocalDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function parseScheduleTime(value: string | undefined): [number, number] | null {
  const match = value?.match(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
  return match ? [Number(match[0].slice(0, 2)), Number(match[0].slice(3, 5))] : null;
}

function shiftDate(value: string | undefined, days: number): string | undefined {
  const date = parseLocalDate(value);
  if (!date) return undefined;
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function differenceInCalendarDays(from: Date, to: Date): number {
  const fromDay = new Date(from);
  const toDay = new Date(to);
  fromDay.setHours(0, 0, 0, 0);
  toDay.setHours(0, 0, 0, 0);
  return Math.round((toDay.getTime() - fromDay.getTime()) / 86_400_000);
}

function subscriptionStartAt(subscription: CustomerSubscription): Date | null {
  const createdAt = new Date(subscription.createdAt);
  const scheduleDate = parseLocalDate(subscription.startDate);
  if (!scheduleDate && Number.isNaN(createdAt.getTime())) return null;

  const start = scheduleDate ?? new Date(createdAt);
  const scheduleTime = parseScheduleTime(subscription.scheduleTime);
  if (scheduleTime) {
    start.setHours(scheduleTime[0], scheduleTime[1], 0, 0);
    return start;
  }

  if (Number.isNaN(createdAt.getTime())) {
    start.setHours(9, 0, 0, 0);
    return start;
  }

  // Legacy subscriptions do not yet have a schedule time, so preserve their
  // established creation time until they are moved or edited.
  start.setHours(createdAt.getHours(), createdAt.getMinutes(), 0, 0);
  return start;
}

function addMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function advanceOccurrence(date: Date, frequency: SubscriptionFrequency): Date {
  if (frequency === "Monthly") return addMonthsClamped(date, 1);
  if (frequency === "Quarterly") return addMonthsClamped(date, 3);
  if (frequency === "Yearly") return addMonthsClamped(date, 12);

  const result = new Date(date);
  result.setDate(result.getDate() + (frequency === "Every 2 weeks" ? 14 : 7));
  return result;
}

function scheduleEnd(subscription: CustomerSubscription): Date {
  const configuredEnd = parseLocalDate(subscription.endDate);
  if (configuredEnd) {
    configuredEnd.setHours(23, 59, 59, 999);
    return configuredEnd;
  }

  const horizon = new Date();
  horizon.setFullYear(horizon.getFullYear() + 5);
  return horizon;
}

function subscriptionOccurrences(subscription: CustomerSubscription): SubscriptionCalendarEvent[] {
  const firstOccurrence = subscriptionStartAt(subscription);
  if (!firstOccurrence || subscription.status === "Draft") return [];

  const end = scheduleEnd(subscription);
  // A cancelled subscription remains visible historically, but does not create
  // future appointments after its final update.
  if (subscription.status === "Cancelled") {
    const cancelledAt = new Date(subscription.updatedAt);
    if (!Number.isNaN(cancelledAt.getTime()) && cancelledAt < end) {
      end.setTime(cancelledAt.getTime());
    }
  }

  const className = `csa-subscription-event--${subscription.status
    .toLowerCase()
    .replaceAll(" ", "-")}`;
  const occurrences: SubscriptionCalendarEvent[] = [];
  let occurrence = firstOccurrence;
  let sequence = 0;

  while (occurrence <= end) {
    const eventEnd = new Date(occurrence);
    eventEnd.setHours(eventEnd.getHours() + 1);
    occurrences.push({
      id: `${subscription.id}-${occurrence.toISOString()}`,
      start: new Date(occurrence),
      end: eventEnd,
      title: `${subscription.subscriptionNumber} · ${subscription.customerName}`,
      classNames: ["csa-subscription-event", className],
      extendedProps: { subscription, sequence }
    });
    occurrence = advanceOccurrence(occurrence, subscription.frequency);
    sequence += 1;
  }

  return occurrences;
}

function formatRange(range: VisibleRange, locale: string) {
  const end = new Date(range.end.getTime() - 1);
  const startText = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short"
  }).format(range.start);
  const endText = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(end);

  return `${startText} – ${endText}`;
}

export function CalendarView() {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const now = useNow({ updateInterval: 60_000 });
  const calendarRef = useRef<FullCalendar>(null);
  const focusedSubscriptionRef = useRef<string | null>(null);
  const { subscriptions, updateSubscription } = useSubscriptions();
  const [visibleRange, setVisibleRange] = useState<VisibleRange>(() => {
    const today = new Date();
    const mondayOffset = (today.getDay() + 6) % 7;
    const start = new Date(today);
    start.setDate(today.getDate() - mondayOffset);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  });
  const [isTodayOpen, setIsTodayOpen] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  const rangeLabel = useMemo(
    () => formatRange(visibleRange, locale),
    [locale, visibleRange]
  );

  const subscriptionEvents = useMemo<SubscriptionCalendarEvent[]>(
    () =>
      subscriptions
        .flatMap(subscriptionOccurrences),
    [subscriptions]
  );

  const newestSubscriptionStart = useMemo(
    () =>
      subscriptions.reduce<{ id: string; start: Date } | null>((newest, subscription) => {
        const start = subscriptionStartAt(subscription);
        if (!start || subscription.status === "Draft") return newest;
        return !newest || start.getTime() > newest.start.getTime()
          ? { id: subscription.id, start }
          : newest;
      }, null),
    [subscriptions]
  );

  const visibleAppointmentCount = useMemo(
    () =>
      subscriptionEvents.filter(
        (event) => event.start >= visibleRange.start && event.start < visibleRange.end
      ).length,
    [subscriptionEvents, visibleRange]
  );

  const todayAppointments = useMemo(() => {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return subscriptionEvents
      .filter((event) => event.start >= dayStart && event.start < dayEnd)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [now, subscriptionEvents]);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).format(now),
    [locale, now]
  );

  const formatAppointmentTime = useCallback(
    (date: Date) =>
      new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date),
    [locale]
  );

  useEffect(() => {
    if (!newestSubscriptionStart) return;
    const focusKey = `${newestSubscriptionStart.id}:${newestSubscriptionStart.start.toISOString()}`;
    if (focusedSubscriptionRef.current === focusKey) return;

    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.gotoDate(newestSubscriptionStart.start);
    api.scrollToTime({
      hours: newestSubscriptionStart.start.getHours(),
      minutes: newestSubscriptionStart.start.getMinutes()
    });
    focusedSubscriptionRef.current = focusKey;
  }, [newestSubscriptionStart]);

  const moveCalendar = useCallback((direction: "prev" | "next" | "today") => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api[direction]();
  }, []);

  const handleEventDrop = useCallback(
    async (info: EventDropArg) => {
      const nextStart = info.event.start;
      const previousStart = info.oldEvent.start;
      if (!nextStart || !previousStart) {
        info.revert();
        return;
      }

      const dayOffset = differenceInCalendarDays(previousStart, nextStart);
      const subscription = info.event.extendedProps.subscription as CustomerSubscription | undefined;
      if (!subscription) {
        info.revert();
        return;
      }
      setScheduleError("");
      try {
        await updateSubscription(subscription.id, {
          ...(dayOffset === 0
            ? {}
            : {
                startDate: shiftDate(subscription.startDate, dayOffset),
                nextDeliveryDate: shiftDate(subscription.nextDeliveryDate, dayOffset),
                endDate: shiftDate(subscription.endDate, dayOffset)
              }),
          scheduleTime: toTimeInputValue(nextStart)
        });
      } catch {
        info.revert();
        setScheduleError(t("scheduleUpdateError"));
      }
    },
    [t, updateSubscription]
  );

  return (
    <section className="csa-calendar-page" aria-label={t("title")}>
      <header className="csa-calendar-toolbar">
        <div className="flex min-w-0 items-center gap-3">
          <div className="csa-calendar-toolbar-icon" aria-hidden="true">
            <Icon name="calendar-days" size="md" />
          </div>
          <div className="min-w-0">
            <h1 className="m-0 truncate text-xl font-bold text-m-text">{t("title")}</h1>
            <p className="m-0 mt-0.5 text-sm text-m-text-muted">
              {t("weekSummary", { count: visibleAppointmentCount })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => setIsTodayOpen(true)}>
            {t("today")}
          </Button>
          <Button
            aria-label={t("previousWeek")}
            iconOnly
            leftIcon={<Icon name="chevron-left" size="sm" />}
            variant="secondary"
            onClick={() => moveCalendar("prev")}
          />
          <span className="csa-calendar-view-label">{t("currentWeek")}</span>
          <Button
            aria-label={t("nextWeek")}
            iconOnly
            leftIcon={<Icon name="chevron-right" size="sm" />}
            variant="secondary"
            onClick={() => moveCalendar("next")}
          />
          <span className="csa-calendar-range" aria-live="polite">
            {rangeLabel}
          </span>
        </div>
      </header>

      {scheduleError && (
        <div className="rounded-m-lg border border-m-error-border bg-m-error-light px-4 py-3 text-sm font-semibold text-m-error">
          {scheduleError}
        </div>
      )}

      <div className="csa-calendar-grid">
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, interactionPlugin]}
          locales={allLocales}
          locale={locale}
          initialView="timeGridWeek"
          firstDay={1}
          allDaySlot={false}
          headerToolbar={false}
          height="auto"
          expandRows
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          slotLabelFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
          dayHeaderFormat={{ weekday: "short", day: "numeric", month: "short" }}
          nowIndicator
          editable
          eventDurationEditable={false}
          eventDrop={handleEventDrop}
          events={subscriptionEvents}
          datesSet={({ start, end }) => setVisibleRange({ start, end })}
        />
      </div>

      <Modal isOpen={isTodayOpen} onClose={() => setIsTodayOpen(false)} size="lg">
        <Modal.Header
          title={t("today")}
          subtitle={t("todaySummary", { count: todayAppointments.length })}
          onClose={() => setIsTodayOpen(false)}
        />
        <Modal.Body>
          <div className="overflow-hidden rounded-m-lg border border-m-border bg-m-surface-1">
            <div className="border-b border-m-border bg-m-surface-2 px-4 py-3 text-sm font-semibold text-m-text">
              {todayLabel}
            </div>
            {todayAppointments.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-m-text-muted">
                {t("todayEmpty")}
              </div>
            ) : (
              <div className="divide-y divide-m-border/70">
                {todayAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center gap-4 px-4 py-3"
                  >
                    <span
                      className={`h-10 w-1 shrink-0 rounded-full ${
                        appointment.extendedProps.subscription.status === "On Hold"
                          ? "bg-m-warning"
                          : appointment.extendedProps.subscription.status === "Paused"
                            ? "bg-m-text-muted"
                            : "bg-m-primary"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="w-20 shrink-0 text-sm font-semibold text-m-text-muted">
                      {formatAppointmentTime(appointment.start)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-m-text">
                      {appointment.extendedProps.subscription.customerName}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-m-primary">
                      {appointment.extendedProps.subscription.subscriptionNumber}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal.Body>
      </Modal>
    </section>
  );
}
