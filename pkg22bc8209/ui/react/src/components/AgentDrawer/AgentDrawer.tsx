/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import { SidePanel } from '@/components/ui/side-panel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import { askAgent, approveWorkOrder, dismissWorkOrder } from '@/shared/api/anuva';
import { formatDate } from '@/shared/api';
import type { AskEntity, AskProposedAction } from '@/Interfaces';
import WorkOrderCard from '../WorkOrderCard/WorkOrderCard';

const SUGGESTED_PROMPTS = [
  'What should 2 crews inspect this week?',
  'What if S3 fails on a 95°F day?',
  'Which buildings are wasting the most energy?',
];

const MAX_TURNS = 10;
const APPROVER = 'Facilities manager';

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

/**
 * "Ask the agent" (FRONTEND §5.8). Self-contained: owns its own floating trigger +
 * open state so it can be dropped onto any page without a shell change. The TopNav's
 * "✦ Ask the agent" button (Arnav's) presses the floating trigger below — keep that
 * button's `fixed` class and label stable, App.tsx's bridge looks them up.
 * Escape closes the drawer; entity chips and asset links close it as they navigate.
 */
export default function AgentDrawer({ asOf }: { asOf: string }) {
  const { reportError } = useErrorReporter();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

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
      setError('Agent unavailable — the ranked queue is still current.');
    } finally {
      setLoading(false);
    }
  };

  const close = () => setOpen(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} className="fixed right-6 bottom-6 z-40 shadow-md" leadingIcon={<Sparkles />}>
        Ask the agent
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={close}>
          <div className="h-full w-[420px] max-w-full" onClick={(e) => e.stopPropagation()}>
            <SidePanel
              behavior="overlay"
              title="Ask the agent"
              subtitle={`As of ${formatDate(asOf)}`}
              onClose={close}
              className="w-[420px]"
              footer={
                <form
                  className="flex w-full flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    ask(question);
                  }}
                >
                  <Textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask a question…"
                    aria-label="Question for the agent"
                    rows={2}
                    className="w-full"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        ask(question);
                      }
                    }}
                  />
                  <Button type="submit" loading={loading} disabled={!question.trim()} className="w-full">
                    Ask
                  </Button>
                </form>
              }
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <Badge key={prompt} variant="outline" appearance="secondary" onClick={() => ask(prompt)}>
                      {prompt}
                    </Badge>
                  ))}
                </div>

                <div className="flex flex-col gap-4" aria-live="polite">
                  {turns.map((turn, i) => (
                    <div key={`${turn.question}-${i}`} className="bib-rise flex flex-col gap-2">
                      <div className="text-[14px] font-semibold leading-5 text-[var(--bib-ink)]">{turn.question}</div>
                      <div className="text-[15px] leading-6 text-[var(--bib-ink)]">{turn.answer}</div>
                      {turn.entities.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {turn.entities.map((entity) => {
                            const href = entityHref(entity);
                            return href ? (
                              <Link key={`${entity.kind}-${entity.id}`} to={href} onClick={close}>
                                <Badge variant="soft" appearance="accent" size="sm">
                                  {entity.label}
                                </Badge>
                              </Link>
                            ) : (
                              <Badge key={`${entity.kind}-${entity.id}`} variant="soft" appearance="secondary" size="sm">
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
                          onApprove={() => approveWorkOrder(action.work_order.wo_id, APPROVER)}
                          onDismiss={(reason) => dismissWorkOrder(action.work_order.wo_id, reason)}
                          onNavigate={close}
                        />
                      ))}
                    </div>
                  ))}
                  {loading ? (
                    <div className="flex items-center gap-2 text-[14px] text-[var(--bib-ink-muted)]">
                      <Loader2 className="size-4 animate-spin" aria-hidden /> Thinking…
                    </div>
                  ) : null}
                  {error ? (
                    <div role="alert" className="text-[14px] font-medium text-[var(--bib-status-due)]">
                      {error}
                    </div>
                  ) : null}
                  {turns.length === 0 && !loading ? (
                    <div className="text-[14px] leading-5 text-[var(--bib-ink-muted)]">
                      Ask about what to inspect, energy waste, or a what-if scenario.
                    </div>
                  ) : null}
                </div>
              </div>
            </SidePanel>
          </div>
        </div>
      ) : null}
    </>
  );
}
