import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITHOUT_CLIENT_HEADER = 'allowWithoutClientHeader';

// For callers that are not the web app and carry their own secret (agent callbacks).
export const AllowWithoutClientHeader = () =>
  SetMetadata(ALLOW_WITHOUT_CLIENT_HEADER, true);
