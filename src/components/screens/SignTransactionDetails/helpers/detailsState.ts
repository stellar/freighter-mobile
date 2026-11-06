import {
  SignTransactionDetailsInterface,
  SignTransactionDetailsState,
} from "components/screens/SignTransactionDetails/types";

/**
 * The details to render for a state, or `null` when there is nothing to render.
 *
 * `null` covers both `empty` and `undisplayable`, which is what callers that
 * only draw the details (send and swap review) want. A caller that has to tell
 * them apart reads the state itself.
 *
 * Lives apart from the hook module so a test can mock that module wholesale
 * without taking this with it.
 *
 * @param state - The state `useSignTransactionDetailsState` returned.
 * @returns The details when the state is `ready`, otherwise `null`.
 */
export const getDisplayableDetails = (
  state: SignTransactionDetailsState,
): SignTransactionDetailsInterface | null =>
  state.status === "ready" ? state.details : null;
