import { memo, useState } from 'react';

import { RequestMethods } from '@truyenmoinhu/query';
import { TmnButton, TmnFlex, TmnInput, UIUtils } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { SPRINT_BACKLOG, SPRINT_NEW, TICKET_ENDPOINTS } from '../constants';
import { useSprintMutation } from '../hooks';
import { defaultCompleteTarget } from '../utils';

import type { ISprint, SprintTarget } from '../types';

export interface ICompleteSprintDialogProps {
  sprint: ISprint;
  futures: ISprint[];
  onDone: () => void;
}
// Asks where the unfinished tickets of the sprint go.
const CompleteSprintDialog = ({
  sprint,
  futures,
  onDone
}: ICompleteSprintDialogProps) => {
  const [target, setTarget] = useState(defaultCompleteTarget(futures));
  const complete = useSprintMutation();

  const submit = async () => {
    const value: SprintTarget =
      target === SPRINT_NEW || target === SPRINT_BACKLOG
        ? target
        : Number(target);
    try {
      await complete.mutateAsync({
        url: TICKET_ENDPOINTS.sprints(`${sprint.id}/complete`),
        method: RequestMethods.POST,
        data: { target: value }
      });
      onDone();
    } catch (e) {
      UIUtils.notify.error(
        e instanceof Error && e.message ? e.message : trans('sprint.failed')
      );
    }
  };

  return (
    <TmnFlex direction="column" gap={4}>
      <TmnInput.Select
        label={trans('sprint.complete_target')}
        value={target}
        onChange={value => setTarget(String(value))}
        options={[
          ...futures.map(s => ({ value: String(s.id), label: s.name })),
          { value: SPRINT_NEW, label: trans('sprint.new') },
          { value: SPRINT_BACKLOG, label: trans('sprint.backlog') }
        ]}
      />
      <TmnFlex direction="row" gap={2}>
        <TmnButton
          kind="primary"
          disabled={complete.isPending}
          onClick={submit}
        >
          {trans('sprint.complete')}
        </TmnButton>
        <TmnButton onClick={onDone}>{trans('ticket.cancel')}</TmnButton>
      </TmnFlex>
    </TmnFlex>
  );
};
export default memo(CompleteSprintDialog);
