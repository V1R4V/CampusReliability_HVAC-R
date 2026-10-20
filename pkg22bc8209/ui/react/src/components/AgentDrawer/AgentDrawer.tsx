/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, SendHorizonal, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidePanel } from '@/components/ui/side-panel';
import { Textarea } from '@/components/ui/textarea';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import { formatDate } from '@/shared/api';
import { approveWorkOrder, askAgent, dismissWorkOrder, editWorkOrder } from '@/shared/api/anuva';
import type { AskEntity, AskProposedAction } from '@/Interfaces';
import WorkOrderCard from '../WorkOrderCard/WorkOrderCard';

const SUGGESTED_PROMPTS = [
  'What should 2 crews inspect this week?',
  'What if S3 fails on a 95°F day?',
  'Which buildings are wasting the most energy?',
];

const MAX_TURNS = 10;
const APPROVER = 'Facilities manager';
/** What Tab cycles through inside the drawer (focus never leaves it while open). */
const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Turn {
  question: string;
  answer: string;
  entities: AskEntity[];
  proposedActions: AskProposedAction[];
}

function entityHref(entity: AskEntity): string | null {
  if (entity.kind === 'asset') return `/asset/${entity.id}`;
  if (entity.kind === 'building') return `/building/${entity.id}`;
  if (entity.kind === 'segment') return `/planb/${entity.id}`;
  return null;
}

export interface AgentDrawerProps {
  asOf: string;
  /** Controlled by the shell: the TopNav "Ask the agent" button is the only trigger. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AgentAvatar() {
  return (
    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--bib-ink)] text-white [&_svg]:size-4">
      <Sparkles aria-hidden />
    </span>
  );
}

/**
 * "Ask the agent" (FRONTEND §5.8): a right-hand slide-over with suggested prompts, the
 * agent's answers, entity chips that navigate, and any proposed work orders (always
 * PENDING_APPROVAL). Rendered once by App.tsx and opened from the TopNav button.
 *
 * Accessibility: a modal dialog. Focus moves to the question box when it opens, Tab cycles
 * inside the drawer, Escape (or the backdrop, or the close button) closes it, and focus
 * returns to whatever opened it. Answers arrive in a polite live region; errors are alerts.
 */
export default function AgentDrawer({ asOf, open, onOpenChange }: AgentDrawerProps) {
  const { reportError } = useErrorReporter();
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Read through a ref so the focus effect below never re-runs just because the parent re-rendered.
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns.length, loading]);

  // Focus management: into the drawer on open, trapped while open, back to the opener on close.
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const questionBox = panel?.querySelector<HTMLElement>('textarea');
    (questionBox ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChangeRef.current(false);
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panel.contains(active);
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, [open]);

  const setOpen = (next: boolean) => onOpenChange(next);

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await askAgent(trimmed, asOf);
      setTurns((prev) =>
        [
          ...prev,
          {
            question: trimmed,
            answer: response.answer,
            entities: response.entities ?? [],
            proposedActions: response.proposed_actions ?? [],
          },
        ].slice(-MAX_TURNS),
      );
      setQuestion('');
    } catch (err) {
      reportError(err);
      setError('Agent unavailable. The ranked queue is still current.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[rgb(17_24_39_/_0.35)] backdrop-blur-[2px]"
      // Only a click on the backdrop itself closes; clicks inside the dialog bubble up with a different target.
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ask the agent"
        tabIndex={-1}
        className="h-full w-[460px] max-w-full bib-rise outline-none"
      >
        <SidePanel
          behavior="overlay"
          title="Ask the agent"
          subtitle={`Answers use the campus state as of ${formatDate(asOf)}`}
          onClose={() => setOpen(false)}
          className="w-[460px] max-w-full"
          footer={
            <form
              className="flex w-full items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                ask(question);
              }}
            >
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about what to inspect, energy waste, or a what-if…"
                rows={2}
                className="w-full text-[15px]"
                aria-label="Your question for the agent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    ask(question);
                  }
                }}
              />
              <Button type="submit" size="lg" loading={loading} disabled={!question.trim()} leadingIcon={<SendHorizonal />}>
                Ask
              </Button>
            </form>
          }
        >
          <div className="flex flex-col gap-5">
            {turns.length === 0 ? (
              <div className="flex flex-col gap-3">
                <div className="bib-hero p-4">
                  <div className="flex items-start gap-3">
                    <span className="bib-hero-tile size-9 shrink-0 [&_svg]:size-4">
                      <Sparkles aria-hidden />
                    </span>
                    <div>
                      <div className="text-[16px] font-semibold leading-6 text-white">Ask about today’s campus</div>
                      <p className="bib-hero-muted mt-1 text-[14px] leading-5">
                        The agent reads the same ranked queue, asset histories and outage plans you see here. It drafts work orders; it never
                        approves or runs anything.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bib-eyebrow" id="bib-agent-prompts">
                  Suggested questions
                </div>
                <ul className="flex flex-col gap-2" aria-labelledby="bib-agent-prompts">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <li key={prompt}>
                      <button
                        type="button"
                        onClick={() => ask(prompt)}
                        disabled={loading}
                        className="bib-card bib-card-interactive flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-[15px] leading-5 text-[var(--bib-ink)] outline-none focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)] disabled:opacity-60"
                      >
                        <span>{prompt}</span>
                        <ArrowRight className="size-4 shrink-0 text-[var(--bib-ink-muted)]" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <Button key={prompt} size="sm" variant="outline" appearance="secondary" onClick={() => ask(prompt)} disabled={loading}>
                    {prompt}
                  </Button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-5" aria-live="polite" aria-busy={loading} aria-relevant="additions text">
              {turns.map((turn, i) => (
                <div key={`${turn.question}-${i}`} className="flex flex-col gap-3">
                  <div className="ml-10 self-end rounded-[6px] rounded-tr-[2px] bg-[var(--bib-ink)] px-3.5 py-2.5 text-[15px] leading-5 text-white shadow-[var(--bib-shadow-card)]">
                    <span className="sr-only">You asked: </span>
                    {turn.question}
                  </div>
                  <div className="flex items-start gap-3">
                    <AgentAvatar />
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <p className="text-[15px] leading-6 text-[var(--bib-ink)]">
                        <span className="sr-only">Agent: </span>
                        {turn.answer}
                      </p>
                      {turn.entities.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {turn.entities.map((entity) => {
                            const href = entityHref(entity);
                            return href ? (
                              <Link
                                key={`${entity.kind}-${entity.id}`}
                                to={href}
                                onClick={() => setOpen(false)}
                                className="rounded-full outline-none focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)]"
                              >
                                <Badge variant="soft" appearance="accent" size="md" trailingIcon={<ArrowRight />}>
                                  {entity.label}
                                </Badge>
                              </Link>
                            ) : (
                              <Badge key={`${entity.kind}-${entity.id}`} variant="soft" appearance="secondary" size="md">
                                {entity.label}
                              </Badge>
                            );
                          })}
                        </div>
                      ) : null}
                      {turn.proposedActions.map((action) => (
                        <WorkOrderCard
                          key={action.work_order.wo_id}
                          workOrder={action.work_order}
                          onApprove={() => approveWorkOrder(action.work_order.wo_id, APPROVER, asOf)}
                          onDismiss={(reason) => dismissWorkOrder(action.work_order.wo_id, reason, asOf)}
                          onEdit={(fields) => editWorkOrder(action.work_order.wo_id, fields, asOf)}
                          asOf={asOf}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {loading ? (
                <div className="flex items-center gap-3 text-[14px] text-[var(--bib-ink-muted)]">
                  <AgentAvatar />
                  <span className="inline-flex items-center gap-1" aria-hidden>
                    <span className="size-1.5 animate-bounce rounded-full bg-[var(--bib-ink-muted)] [animation-delay:-0.2s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-[var(--bib-ink-muted)] [animation-delay:-0.1s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-[var(--bib-ink-muted)]" />
                  </span>
                  Thinking…
                </div>
              ) : null}
              {error ? (
                <div role="alert" className="text-[14px] font-medium text-[var(--bib-status-due)]">
                  {error}
                </div>
              ) : null}
              <div ref={endRef} />
            </div>
          </div>
        </SidePanel>
      </div>
    </div>
  );
}
