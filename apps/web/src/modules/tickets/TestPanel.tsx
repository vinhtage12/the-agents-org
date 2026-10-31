import { memo } from 'react';

import { TmnCallout, TmnFlex, TmnText } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { MAX_FIX_ROUNDS } from './constants';
import FeedbackForm from './FeedbackForm';

import type { ITicketDetail } from './types';
export interface ITestPanelProps {
  ticket: ITicketDetail;
}
const TestPanel = ({ ticket }: ITestPanelProps) => {
  const resultByPosition = new Map(
    (ticket.testResults?.results ?? []).map(r => [r.position, r])
  );
  const running = ticket.runs.some(run => run.status === 'RUNNING');
  const exhausted = ticket.status === 'IN_TESTING' && !running;

  return (
    <TmnFlex direction="column" gap={3}>
      <TmnText className="text-xs text-muted-foreground">
        {trans('ticket.fix_round', {
          round: ticket.fixRound,
          max: MAX_FIX_ROUNDS
        })}
      </TmnText>
      {exhausted && (
        <TmnCallout color="orange">
          <TmnText weight="bold">
            {trans('ticket.fix_rounds_exhausted', { max: MAX_FIX_ROUNDS })}
          </TmnText>
          <TmnText className="text-sm">
            {trans('ticket.fix_rounds_exhausted_hint')}
          </TmnText>
        </TmnCallout>
      )}
      {!ticket.testCases.length ? (
        <TmnText className="text-sm text-muted-foreground">
          {trans('ticket.tests_empty')}
        </TmnText>
      ) : (
        ticket.testCases.map(testCase => {
          const result = resultByPosition.get(testCase.position);
          return (
            <TmnFlex
              key={testCase.id}
              direction="column"
              gap={1}
              className="rounded-md border border-border p-2"
            >
              <TmnFlex direction="row" gap={2} align="center">
                <TmnText weight="bold" className="text-sm">
                  {testCase.position}. {testCase.title}
                </TmnText>
                {result && (
                  <TmnText
                    className={
                      result.passed
                        ? 'text-xs text-green-600 dark:text-green-400'
                        : 'text-xs text-red-600 dark:text-red-400'
                    }
                  >
                    {trans(
                      result.passed
                        ? 'ticket.test_passed'
                        : 'ticket.test_failed'
                    )}
                  </TmnText>
                )}
              </TmnFlex>
              <TmnText className="text-xs whitespace-pre-wrap">
                {testCase.steps}
              </TmnText>
              <TmnText className="text-xs text-muted-foreground whitespace-pre-wrap">
                {trans('ticket.test_expected', { expected: testCase.expected })}
              </TmnText>
              {result?.detail && (
                <TmnText className="text-xs whitespace-pre-wrap">
                  {result.detail}
                </TmnText>
              )}
            </TmnFlex>
          );
        })
      )}
      {(exhausted || ticket.status === 'IN_REVIEW') && (
        <FeedbackForm ticketId={ticket.id} target="dev" disabled={false} />
      )}
    </TmnFlex>
  );
};
export default memo(TestPanel);
