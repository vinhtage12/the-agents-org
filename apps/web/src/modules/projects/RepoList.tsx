import { memo, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

import { RequestMethods } from '@truyenmoinhu/query';
import {
  TmnBadge,
  TmnButton,
  TmnFlex,
  TmnText,
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { useProjectSettingsMutation } from './hooks';
import RepoForm from './RepoForm';
import { settingsPath } from './utils';

import type { IProjectRepo, IProjectSettingsProps } from './types';
export interface IRepoListProps extends IProjectSettingsProps {
  repos: IProjectRepo[];
  defaultRepoId: number | null;
}
const RepoList = ({
  workspaceId,
  projectId,
  repos,
  defaultRepoId
}: IRepoListProps) => {
  const [editing, setEditing] = useState<number | null>(null);
  const busy = useRef(false);
  const mutation = useProjectSettingsMutation();

  const remove = (repo: IProjectRepo) => {
    const modal = `delete-repo-${repo.id}`;
    UIUtils.alert.open(modal, {
      title: trans('project.delete_repo_title'),
      message: trans('project.delete_repo_message', { name: repo.name }),
      cancelTitle: trans('project.cancel'),
      actions: () => [
        {
          kind: 'error',
          children: trans('project.delete'),
          onClick: async event => {
            event.preventDefault();
            if (busy.current) {
              return;
            }
            busy.current = true;
            try {
              await mutation.mutateAsync({
                url: settingsPath(workspaceId, projectId, `repos/${repo.id}`),
                method: RequestMethods.DELETE
              });
              UIUtils.alert.dismissByName(modal);
              UIUtils.notify.success(trans('project.repo_deleted'));
            } catch {
              UIUtils.notify.error(trans('project.save_failed'));
            } finally {
              busy.current = false;
            }
          }
        }
      ]
    });
  };

  if (!repos.length) {
    return (
      <TmnText as="p" className="text-sm text-muted-foreground">
        {trans('project.no_repos')}
      </TmnText>
    );
  }

  return (
    <TmnFlex direction="column" gap={2}>
      {repos.map(repo =>
        editing === repo.id ? (
          <RepoForm
            key={repo.id}
            workspaceId={workspaceId}
            projectId={projectId}
            repo={repo}
            onDone={() => setEditing(null)}
          />
        ) : (
          <TmnFlex
            key={repo.id}
            direction="row"
            align="center"
            gap={2}
            className="rounded border border-border p-2"
          >
            <TmnFlex direction="column" className="min-w-0 flex-1">
              <TmnFlex direction="row" align="center" gap={2}>
                <TmnText weight="medium">{repo.name}</TmnText>
                {repo.id === defaultRepoId && (
                  <TmnBadge>{trans('project.default')}</TmnBadge>
                )}
              </TmnFlex>
              <TmnText className="truncate text-xs text-muted-foreground">
                {repo.path}
              </TmnText>
            </TmnFlex>
            <TmnButton
              variant="transparent"
              startIcon={Pencil}
              aria-label={trans('project.edit_repo', { name: repo.name })}
              onClick={() => setEditing(repo.id)}
            />
            <TmnButton
              variant="transparent"
              startIcon={Trash2}
              aria-label={trans('project.delete_repo', { name: repo.name })}
              onClick={() => remove(repo)}
            />
          </TmnFlex>
        )
      )}
    </TmnFlex>
  );
};
export default memo(RepoList);
