import { test } from 'vitest';
import assert from 'node:assert/strict';
import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalHttpExceptionFilter } from '../src/common/http-exception.filter.ts';

test('GlobalHttpExceptionFilter preserves structured HttpException fields', () => {
  const filter = new GlobalHttpExceptionFilter();
  const jsonCalls = [];
  const response = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      jsonCalls.push(payload);
      return this;
    }
  };
  const request = {
    url: '/assistants/default-assistant/ask'
  };
  const host = {
    switchToHttp() {
      return {
        getResponse() {
          return response;
        },
        getRequest() {
          return request;
        }
      };
    }
  };

  const exception = new HttpException(
    {
      statusCode: HttpStatus.BAD_GATEWAY,
      error: 'Bad Gateway',
      message: 'Ask pipeline failed.',
      code: 'ASK_PIPELINE_FAILED',
      traceId: 'trace-1',
      details: { stage: 'answering' }
    },
    HttpStatus.BAD_GATEWAY
  );

  filter.catch(exception, host);

  assert.equal(response.statusCode, HttpStatus.BAD_GATEWAY);
  assert.equal(jsonCalls.length, 1);
  assert.equal(jsonCalls[0].statusCode, HttpStatus.BAD_GATEWAY);
  assert.equal(jsonCalls[0].error, 'Bad Gateway');
  assert.equal(jsonCalls[0].message, 'Ask pipeline failed.');
  assert.equal(jsonCalls[0].code, 'ASK_PIPELINE_FAILED');
  assert.equal(jsonCalls[0].traceId, 'trace-1');
  assert.deepEqual(jsonCalls[0].details, { stage: 'answering' });
  assert.equal(jsonCalls[0].path, '/assistants/default-assistant/ask');
  assert.equal(typeof jsonCalls[0].timestamp, 'string');
});

test('GlobalHttpExceptionFilter hides internal causes from 5xx details in production', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const filter = new GlobalHttpExceptionFilter();
    const jsonCalls = [];
    const response = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        jsonCalls.push(payload);
        return this;
      }
    };
    const host = {
      switchToHttp() {
        return {
          getResponse() {
            return response;
          },
          getRequest() {
            return { url: '/assistants/default-assistant/ask' };
          }
        };
      }
    };

    filter.catch(
      new HttpException(
        {
          statusCode: HttpStatus.BAD_GATEWAY,
          error: 'Bad Gateway',
          message: 'Ask pipeline failed.',
          code: 'ASK_PIPELINE_FAILED',
          details: {
            stage: 'retrieval',
            cause: 'connect ECONNREFUSED 10.0.0.5:5432'
          }
        },
        HttpStatus.BAD_GATEWAY
      ),
      host
    );

    assert.equal(jsonCalls[0].message, 'Ask pipeline failed.');
    assert.equal(jsonCalls[0].code, 'ASK_PIPELINE_FAILED');
    assert.deepEqual(jsonCalls[0].details, { stage: 'retrieval' });
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test('GlobalHttpExceptionFilter hides unexpected error messages in production', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const filter = new GlobalHttpExceptionFilter();
    const jsonCalls = [];
    const response = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        jsonCalls.push(payload);
        return this;
      }
    };
    const host = {
      switchToHttp() {
        return {
          getResponse() {
            return response;
          },
          getRequest() {
            return { url: '/api/test' };
          }
        };
      }
    };

    filter.catch(new Error('relation "Thing" does not exist'), host);

    assert.equal(jsonCalls[0].message, 'An unexpected server error occurred.');
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
});
