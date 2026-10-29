import { generateEndpoint } from '@truyenmoinhu/query';
export const withGenerateEndpoint = (endpoint: string) => {
  return (path?: string, query?: Record<string, string | number>) =>
    generateEndpoint(endpoint, path, query);
};
