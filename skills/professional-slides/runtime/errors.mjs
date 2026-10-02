// One exit-code scheme for every command of the pipeline (build-deck,
// deliver-deck, storyline, reviewer merge; runtime/README.md#exit-codes), so a
// calling agent reads any step's status the same way: 0 done, 1 a crash or a
// usage error, 2 refused (blockers, a rejection, an invalid answer, a capped
// loop), 3 waiting on a reviewer - a packet was written for one.
export const EXIT = Object.freeze({ ok: 0, error: 1, refused: 2, waiting: 3 });

// A refusal is the input breaking a rule the author can repair, not a crash.
// Every CLI prints its message without a stack trace and exits EXIT.refused (2);
// a crash keeps EXIT.error (1). `findings` carries the same records a gate
// report does, so a caller can write them (deliver-deck writes REJECTED.md).
export class RefusalError extends Error {
  constructor(code, message, findings = []) {
    super(message);
    this.name = "RefusalError";
    this.code = code;
    this.findings = findings;
  }
}

export const isRefusal = (error) => error instanceof RefusalError || error?.refusal === true;

// A command line the CLI cannot read: an unknown option, an option missing its
// value, a missing argument. Printed without a stack; exits EXIT.error (1).
export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

/**
 * `code`, once `registry` - a module's frozen table of the codes it raises and
 * what each is about - names it. A finding raised under a code its module
 * does not document is a bug in the module, and throws.
 */
export function registered(registry, code) {
  if (!Object.hasOwn(registry, code)) throw new Error(`Unregistered finding code: ${code}`);
  return code;
}
