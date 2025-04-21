/* eslint-disable no-underscore-dangle */
import { FormattedSearchAssetRecord } from "components/screens/AddAssetScreen/types";
import { NETWORKS } from "config/constants";
import { PricedBalance, SearchAssetResponse } from "config/types";
import { formatAssetIdentifier } from "helpers/balances";
import { isContractId } from "helpers/soroban";
import useDebounce from "hooks/useDebounce";
import { useState } from "react";
import { handleContractLookup } from "services/backend";
import { searchAsset } from "services/stellarExpert";

export enum AssetLookupStatus {
  IDLE = "idle",
  LOADING = "loading",
  SUCCESS = "success",
  ERROR = "error",
}

interface UseAssetLookupProps {
  network: NETWORKS;
  publicKey?: string;
  balanceItems: (PricedBalance & {
    id: string;
  })[];
}

export const useAssetLookup = ({
  network,
  publicKey,
  balanceItems,
}: UseAssetLookupProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<
    FormattedSearchAssetRecord[]
  >([]);
  const [status, setStatus] = useState<AssetLookupStatus>(
    AssetLookupStatus.IDLE,
  );

  const checkIfUserHasTrustline = (
    currentBalances: (PricedBalance & {
      id: string;
    })[],
    assetCode: string,
    issuer: string,
  ) => {
    const balance = currentBalances.find((currentBalance) => {
      const formattedCurrentBalance = formatAssetIdentifier(currentBalance.id);

      return (
        formattedCurrentBalance.assetCode === assetCode &&
        formattedCurrentBalance.issuer === issuer
      );
    });

    return !!balance;
  };

  const formatSearchAssetRecords = (
    records:
      | SearchAssetResponse["_embedded"]["records"]
      | FormattedSearchAssetRecord[],
    currentBalances: (PricedBalance & {
      id: string;
    })[],
  ): FormattedSearchAssetRecord[] =>
    records
      .map((record) => {
        if ("assetCode" in record) {
          return {
            ...record,
            hasTrustline: checkIfUserHasTrustline(
              currentBalances,
              record.assetCode,
              record.issuer,
            ),
          };
        }

        const formattedTokenRecord = record.asset.split("-");
        const assetCode = formattedTokenRecord[0];
        const issuer = formattedTokenRecord[1] ?? "";

        return {
          assetCode,
          domain: record.domain ?? "",
          hasTrustline: checkIfUserHasTrustline(
            currentBalances,
            assetCode,
            issuer,
          ),
          issuer,
          isNative: record.asset === "XLM",
        };
      })
      .sort((a) => {
        if (a.hasTrustline) {
          return -1;
        }

        return 1;
      });

  const debouncedSearch = useDebounce(() => {
    const performSearch = async () => {
      if (!searchTerm) {
        setStatus(AssetLookupStatus.IDLE);
        setSearchResults([]);
        return;
      }

      setStatus(AssetLookupStatus.LOADING);

      let resJson;

      if (isContractId(searchTerm)) {
        const lookupResult = await handleContractLookup(
          searchTerm,
          network,
          publicKey,
        ).catch(() => {
          setStatus(AssetLookupStatus.ERROR);
          return null;
        });

        resJson = lookupResult ? [lookupResult] : [];
      } else {
        const response = await searchAsset(searchTerm, network);

        resJson = response && response._embedded && response._embedded.records;
      }

      if (!resJson) {
        setStatus(AssetLookupStatus.ERROR);
        return;
      }

      const formattedRecords = formatSearchAssetRecords(resJson, balanceItems);

      setSearchResults(formattedRecords);
      setStatus(AssetLookupStatus.SUCCESS);
    };

    performSearch();
  });

  const handleSearch = (text: string) => {
    if (text === searchTerm) {
      return;
    }

    setSearchTerm(text);
    debouncedSearch();
  };

  const resetSearch = () => {
    setStatus(AssetLookupStatus.IDLE);
    setSearchResults([]);
    setSearchTerm("");
  };

  return {
    searchTerm,
    searchResults,
    status,
    handleSearch,
    resetSearch,
  };
};
