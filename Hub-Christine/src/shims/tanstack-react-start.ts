export function createServerFn(options?: { method?: 'GET' | 'POST' }) {
  return {
    validator<TValidator>(_validatorSchema: TValidator) {
      return {
        handler<TResult>(
          fn: (ctx: { data: any }) => Promise<TResult>
        ) {
          const callable = async (ctx?: { data?: any }): Promise<TResult> => {
            return fn({ data: ctx?.data ?? {} });
          };
          return callable;
        },
      };
    },
    handler<TResult>(fn: (ctx: { data?: any }) => Promise<TResult>) {
      const callable = async (ctx?: { data?: any }): Promise<TResult> => {
        return fn({ data: ctx?.data ?? {} });
      };
      return callable;
    },
  };
}
