export interface ISnapshot {
  sampledAt: string | null;
}
export interface IUsageWindow {
  label: string;
  usedPercent: number;
  resetsAt: string | null;
}
export interface IUsageResponse<
  TProvider extends IProviderUsage = IProviderUsage
> {
  providers: TProvider[];
}
export interface IDockerContainer {
  id: string;
  name: string;
  state: string;
  health: string;
  cpu: string | null;
  memory: string | null;
  cpuPercent: number | null;
  memoryUsageBytes: number | null;
  memoryLimitBytes: number | null;
  memoryPercent: number | null;
}
export interface IDocker extends ISnapshot {
  status: string;
  sampledAt: string;
  containers: IDockerContainer[];
}
export interface IProviderUsage extends ISnapshot {
  provider: string;
  status: string;
  windows: IUsageWindow[];
}
