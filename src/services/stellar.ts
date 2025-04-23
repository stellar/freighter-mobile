import {
  Asset,
  FeeBumpTransaction,
  Horizon,
  Keypair,
  Operation,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import {
  DEFAULT_RECOMMENDED_STELLAR_FEE,
  DEFAULT_TRANSACTION_TIMEOUT,
  mapNetworkToNetworkDetails,
  NETWORKS,
} from "config/constants";
import { NetworkCongestion } from "config/types";
import { formatAssetIdentifier } from "helpers/balances";
import { stroopToXlm, xlmToStroop } from "helpers/formatAmount";

interface HorizonError {
  response: {
    status: number;
  };
}

export type BuildChangeTrustTxParams = {
  network: NETWORKS;
  publicKey: string;
  // composed by assetCode:assetIssuer
  assetIdentifier: string;
  isRemove?: boolean;
};

export type SignTxParams = {
  network: NETWORKS;
  tx: Transaction | FeeBumpTransaction | string;
  secretKey: string;
};

export type SubmitTxParams = {
  network: NETWORKS;
  tx: Transaction | FeeBumpTransaction | string;
};

const isHorizonError = (val: unknown): val is HorizonError =>
  typeof val === "object" &&
  val !== null &&
  "response" in val &&
  typeof val.response === "object" &&
  val.response !== null &&
  "status" in val.response;

export const getIsAllowHttp = (networkUrl: string) =>
  !networkUrl.includes("https");

export const stellarSdkServer = (networkUrl: string): Horizon.Server =>
  new Horizon.Server(networkUrl, {
    allowHttp: getIsAllowHttp(networkUrl),
  });

export const submitTx = async (
  input: SubmitTxParams,
): Promise<Horizon.HorizonApi.SubmitTransactionResponse> => {
  const { network, tx } = input;
  const { networkUrl, networkPassphrase } = mapNetworkToNetworkDetails(network);
  const server = stellarSdkServer(networkUrl);

  const transaction =
    typeof tx === "string"
      ? TransactionBuilder.fromXDR(tx, networkPassphrase)
      : tx;

  let submittedTx;

  try {
    submittedTx = await server.submitTransaction(transaction);
  } catch (e: unknown) {
    if (isHorizonError(e) && e.response.status === 504) {
      // in case of 504, keep retrying this tx until submission succeeds or we get a different error
      // https://developers.stellar.org/api/errors/http-status-codes/horizon-specific/timeout
      // https://developers.stellar.org/docs/encyclopedia/error-handling
      return submitTx({ network, tx });
    }
    throw e;
  }

  return submittedTx;
};

export const getNetworkFees = async (server: Horizon.Server) => {
  let recommendedFee = "";
  let networkCongestion = "" as NetworkCongestion;

  try {
    const { max_fee: maxFee, ledger_capacity_usage: ledgerCapacityUsage } =
      await server.feeStats();
    const ledgerCapacityUsageNum = Number(ledgerCapacityUsage);

    recommendedFee = stroopToXlm(maxFee.mode).toFixed();
    if (ledgerCapacityUsageNum > 0.5 && ledgerCapacityUsageNum <= 0.75) {
      networkCongestion = NetworkCongestion.MEDIUM;
    } else if (ledgerCapacityUsageNum > 0.75) {
      networkCongestion = NetworkCongestion.HIGH;
    } else {
      networkCongestion = NetworkCongestion.LOW;
    }
  } catch (e) {
    // use default values
    recommendedFee = DEFAULT_RECOMMENDED_STELLAR_FEE;
    networkCongestion = NetworkCongestion.LOW;
  }

  return { recommendedFee, networkCongestion };
};

export const buildChangeTrustTx = async (input: BuildChangeTrustTxParams) => {
  const { network, publicKey, assetIdentifier, isRemove = false } = input;
  const { assetCode, issuer } = formatAssetIdentifier(assetIdentifier);
  const { networkUrl, networkPassphrase } = mapNetworkToNetworkDetails(network);

  const server = stellarSdkServer(networkUrl);
  const account = await server.loadAccount(publicKey);
  const { recommendedFee } = await getNetworkFees(server);

  const txBuilder = new TransactionBuilder(account, {
    fee: xlmToStroop(recommendedFee).toFixed(),
    networkPassphrase,
  });

  txBuilder
    .addOperation(
      Operation.changeTrust({
        asset: new Asset(assetCode, issuer),
        // Setting the limit to 0 will remove the trustline.
        ...(isRemove && { limit: "0" }),
      }),
    )
    .setTimeout(DEFAULT_TRANSACTION_TIMEOUT);

  return txBuilder.build().toXDR();
};

export const signTransaction = (input: SignTxParams): string => {
  const { tx, secretKey, network } = input;
  const { networkPassphrase } = mapNetworkToNetworkDetails(network);
  const transactionXDR = typeof tx === "string" ? tx : tx.toXDR();
  const transaction = TransactionBuilder.fromXDR(
    transactionXDR,
    networkPassphrase,
  );

  const keypair = Keypair.fromSecret(secretKey);
  transaction.sign(keypair);

  return transaction.toXDR();
};
