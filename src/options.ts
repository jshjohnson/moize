import { deepEqual, shallowEqual, sameValueZeroEqual } from 'fast-equals';
import { MicroMemoize } from 'micro-memoize';

import { createGetInitialArgs } from './maxArgs';
import { getSerializerFunction, getIsSerializedKeyEqual } from './serialize';
import { assign, compose, getValidHandlers } from './utils';

import { Dictionary, Handler, Options } from './types';

const DEFAULTS: Options = {
  equals: undefined,
  isDeepEqual: false,
  isPromise: false,
  isReact: false,
  isReactGlobal: false,
  isSerialized: false,
  matchesKey: undefined,
  maxAge: undefined,
  maxArgs: undefined,
  maxSize: 1,
  onCacheAdd: undefined,
  onCacheChange: undefined,
  onCacheHit: undefined,
  onExpire: undefined,
  profileName: undefined,
  serializer: undefined,
  transformArgs: undefined,
  updateExpire: false,
};

export const DEFAULT_OPTIONS: Dictionary<Options> = {
  __global__: assign({}, DEFAULTS),
  promise: assign({}, DEFAULTS),
  react: assign({}, DEFAULTS),
  reactGlobal: assign({}, DEFAULTS),
  serialized: assign({}, DEFAULTS),
};

const MERGED_OPTIONS = ['onCacheAdd', 'onCacheChange', 'onCacheHit', 'transformArgs'];

export function getDefaultOptions(options?: Options) {
  if (options) {
    if (options.isPromise) {
      return DEFAULT_OPTIONS.promise;
    }

    if (options.isReact) {
      return options.isReactGlobal ? DEFAULT_OPTIONS.reactGlobal : DEFAULT_OPTIONS.react;
    }

    if (options.isSerialized) {
      return DEFAULT_OPTIONS.serialized;
    }
  }

  return DEFAULT_OPTIONS.__global__;
}

export function getDefaultOptionsType(options: Options) {
  if (options.isPromise) {
    return 'promise';
  }

  if (options.isReact) {
    return options.isReactGlobal ? 'reactGlobal' : 'react';
  }

  if (options.isSerialized) {
    return 'serialized';
  }

  return '__global__';
}

export function getIsEqual(options: Options) {
  return (
    options.equals ||
    (options.isDeepEqual && deepEqual) ||
    (options.isReact && shallowEqual) ||
    sameValueZeroEqual
  );
}

export function getIsMatchingKey(options: Options) {
  return options.matchesKey || (options.isSerialized && getIsSerializedKeyEqual) || undefined;
}

export function getMicroMemoizeOptions(
  options: Options,
  onCacheAdd: Handler | void,
  onCacheHit: Handler | void,
) {
  const isEqual = getIsEqual(options);
  const isMatchingKey = getIsMatchingKey(options);
  const transformKey = getTransformKey(options);

  const microMemoizeOptions: MicroMemoize.Options = {
    isEqual,
    isMatchingKey,
    isPromise: options.isPromise,
    maxSize: options.maxSize,
  };

  if (onCacheAdd) {
    microMemoizeOptions.onCacheAdd = onCacheAdd;
  }

  if (options.onCacheChange) {
    microMemoizeOptions.onCacheChange = options.onCacheChange;
  }

  if (onCacheHit) {
    microMemoizeOptions.onCacheHit = onCacheHit;
  }

  if (transformKey) {
    microMemoizeOptions.transformKey = transformKey;
  }

  return microMemoizeOptions;
}

export function getTransformKey(options: Options) {
  return compose(
    options.isSerialized && getSerializerFunction(options),
    options.transformArgs,
    options.isReact && createGetInitialArgs(2),
    typeof options.maxArgs === 'number' && createGetInitialArgs(options.maxArgs),
  );
}

export function isOptions(value: any): value is Options {
  return !!value && typeof value === 'object';
}

export function mergeOptions(originalOptions: Options, newOptions: Options): Options {
  const mergedOptions = assign({}, originalOptions, newOptions);

  return MERGED_OPTIONS.reduce((_mergedOptions: Options, option: keyof Options) => {
    const handlers = getValidHandlers([originalOptions[option], newOptions[option]]);

    _mergedOptions[option] = handlers.length ? handlers : undefined;

    return _mergedOptions;
  }, mergedOptions);
}

export function setDefaultOptions(type: Options | string, options?: Options) {
  if (typeof type === 'string') {
    const defaultOptions = DEFAULT_OPTIONS[type];

    if (isOptions(defaultOptions)) {
      if (!isOptions(options)) {
        return false;
      }

      Object.keys(options).forEach((option) => {
        defaultOptions[option] = options[option];
      });

      if (type === 'react') {
        setDefaultOptions('reactGlobal', options);
      }

      return true;
    }

    throw new Error(`The type "${type}" passed does not exist as an options type.`);
  }

  if (isOptions(type)) {
    options = type;

    Object.keys(DEFAULT_OPTIONS).forEach((optionType) => {
      const defaultOptions = DEFAULT_OPTIONS[optionType];

      Object.keys(options).forEach((option) => {
        defaultOptions[option] = options[option];
      });
    });

    return true;
  }

  return false;
}
