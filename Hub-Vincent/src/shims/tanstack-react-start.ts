export function createServerFn(options?: any) {
  return {
    validator: (_schema?: any) => ({
      handler: (fn: (args: any) => Promise<any>) => {
        const caller = (args?: any) => fn(args || {});
        caller.handler = fn;
        return caller;
      },
    }),
    handler: (fn: (args: any) => Promise<any>) => {
      const caller = (args?: any) => fn(args || {});
      caller.handler = fn;
      return caller;
    },
  };
}
