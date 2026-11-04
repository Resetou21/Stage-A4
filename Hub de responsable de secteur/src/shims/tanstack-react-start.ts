export function createServerFn(options?: { method?: 'GET' | 'POST' }) {
  return {
    validator<TValidator>(validatorSchema: TValidator) {
      return {
        handler<TResult>(
          fn: (ctx: { data: TValidator extends { _output: infer O } ? O : any }) => Promise<TResult>
        ) {
          const callable = async (ctx: { data: TValidator extends { _output: infer O } ? O : any }): Promise<TResult> => {
            return fn(ctx);
          };
          return callable;
        },
      };
    },
    handler<TResult>(fn: (ctx: { data?: any }) => Promise<TResult>) {
      const callable = async (ctx?: { data?: any }): Promise<TResult> => {
        return fn(ctx ?? {});
      };
      return callable;
    },
  };
}

