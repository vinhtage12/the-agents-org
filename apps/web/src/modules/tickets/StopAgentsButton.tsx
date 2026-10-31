import { memo, useState } from 'react';

import { TmnButton, TmnCallout, TmnFlex, UIUtils } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { useStopAgents } from './hooks';

export interface IStopAgentsButtonProps {
  ticketId: number;
}
// Way out for a run that will never call back (pane closed, crash, denied permission).
const StopAgentsButton = ({ ticketId }: IStopAgentsButtonProps) => {
  const [message, setMessage] = useState('');
  const stop = useStopAgents();

  const onStop = async () => {
    setMessage('');
    try {
      await stop.mutateAsync({ ticketId });
      UIUtils.notify.success(trans('ticket.agents_stopped'));
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : trans('ticket.request_failed')
      );
    }
  };

  return (
    <TmnFlex direction="column" gap={2}>
      <TmnButton
        kind="error"
        variant="outline"
        className="self-start"
        disabled={stop.isPending}
        onClick={onStop}
      >
        {trans('ticket.stop_agents')}
      </TmnButton>
      {message && (
        <TmnCallout role="alert" color="red">
          {message}
        </TmnCallout>
      )}
    </TmnFlex>
  );
};
export default memo(StopAgentsButton);
