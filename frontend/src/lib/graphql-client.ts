import { GraphQLClient } from 'graphql-request';

import { ENV } from '@/consts';

export const graphqlClient = new GraphQLClient(ENV.EXPLORER_URL, {
  headers: {
    'Content-Type': 'application/json',
  },
});
