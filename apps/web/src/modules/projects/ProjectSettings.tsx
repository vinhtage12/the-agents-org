import { memo } from 'react';

import {
  TmnButton,
  TmnCallout,
  TmnCard,
  TmnFlex,
  TmnLoading,
  TmnText
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import DefaultsForm from './DefaultsForm';
import { useAgentProfiles, useProjectSettings } from './hooks';
import RepoForm from './RepoForm';
import RepoList from './RepoList';

import type { IProjectSettingsProps } from './types';

const ProjectSettings = ({ workspaceId, projectId }: IProjectSettingsProps) => {
  const settings = useProjectSettings(workspaceId, projectId);
  const agents = useAgentProfiles();

  if (settings.isLoading || agents.isLoading) {
    return <TmnLoading />;
  }
  if (!settings.data || !agents.data) {
    return (
      <TmnCard header={{ title: trans('project.load_failed') }}>
        <TmnButton
          onClick={() => {
            settings.refetch();
            agents.refetch();
          }}
        >
          {trans('project.retry')}
        </TmnButton>
      </TmnCard>
    );
  }

  const ids = { workspaceId, projectId };

  return (
    <TmnFlex direction="column" gap={4} className="w-full max-w-3xl">
      <TmnCard header={{ title: trans('project.repos') }}>
        <TmnFlex direction="column" gap={4}>
          <RepoList
            {...ids}
            repos={settings.data.repos}
            defaultRepoId={settings.data.defaultRepoId}
          />
          <RepoForm {...ids} />
        </TmnFlex>
      </TmnCard>
      <TmnCard header={{ title: trans('project.defaults') }}>
        <TmnFlex direction="column" gap={3}>
          {agents.data.errors.length > 0 && (
            <TmnCallout color="amber">
              <TmnText>{trans('project.agent_file_errors')}</TmnText>
              {agents.data.errors.map(e => (
                <TmnText key={e.file} as="p" className="text-xs">
                  {e.file}: {e.message}
                </TmnText>
              ))}
            </TmnCallout>
          )}
          {agents.data.profiles.length === 0 && (
            <TmnText as="p" className="text-sm text-muted-foreground">
              {trans('project.no_agents')}
            </TmnText>
          )}
          <DefaultsForm
            key={JSON.stringify(settings.data)}
            {...ids}
            settings={settings.data}
            profiles={agents.data.profiles}
          />
        </TmnFlex>
      </TmnCard>
    </TmnFlex>
  );
};
export default memo(ProjectSettings);
