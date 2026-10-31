process.env.SOURCE_FETCH_ALLOW_PRIVATE_NETWORK =
  process.env.SOURCE_FETCH_ALLOW_PRIVATE_NETWORK ?? 'true';

require('tsx/cjs/api').register();
