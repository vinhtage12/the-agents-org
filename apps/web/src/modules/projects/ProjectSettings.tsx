import { memo } from 'react';

import { TmnButton, TmnCard, TmnFlex, TmnLoading } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import DefaultsForm from './DefaultsForm';
import { useProjectSettings } from './hooks';

import type { IProjectSettingsProps } from './types';

const ProjectSettings = ({ workspaceId, projectId }: IProjectSettingsProps) => {
  const settings = useProjectSettings(workspaceId, projectId);

  if (settings.isLoading) {
    return <TmnLoading />;
  }
  if (!settings.data) {
    return (
      <TmnCard header={{ title: trans('project.load_failed') }}>
        <TmnButton onClick={() => settings.refetch()}>
          {trans('project.retry')}
        </TmnButton>
      </TmnCard>
    );
  }

  return (
    <TmnFlex direction="column" gap={4} className="w-full max-w-3xl">
      <TmnCard header={{ title: trans('project.defaults') }}>
        <DefaultsForm
          key={JSON.stringify(settings.data)}
          workspaceId={workspaceId}
          projectId={projectId}
          settings={settings.data}
        />
      </TmnCard>
    </TmnFlex>
  );
};
export default memo(ProjectSettings);
