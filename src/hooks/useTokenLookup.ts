/* eslint-disable no-underscore-dangle */
import { NATIVE_TOKEN_CODE, NETWORKS } from "config/constants";
import {
  PricedBalance,
  SearchTokenResponse,
  FormattedSearchTokenRecord,
  HookStatus,
} from "config/types";
import { formatTokenIdentifier, getTokenType } from "helpers/balances";
import { isContractId } from "helpers/soroban";
import useDebounce from "hooks/useDebounce";
import { useState } from "react";
import { handleContractLookup } from "services/backend";
import { searchToken } from "services/stellarExpert";

interface UseTokenLookupProps {
  network: NETWORKS;
  publicKey?: string;
  balanceItems: (PricedBalance & {
    id: string;
  })[];
}

export const useTokenLookup = ({
  network,
  publicKey,
  balanceItems,
}: UseTokenLookupProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<
    FormattedSearchTokenRecord[]
  >([]);
  const [status, setStatus] = useState<HookStatus>(HookStatus.IDLE);

  const checkHasTrustline = (
    currentBalances: (PricedBalance & {
      id: string;
    })[],
    tokenCode: string,
    issuer: string,
  ) => {
    const balance = currentBalances.find((currentBalance) => {
      const formattedCurrentBalance = formatTokenIdentifier(currentBalance.id);

      return (
        formattedCurrentBalance.tokenCode === tokenCode &&
        formattedCurrentBalance.issuer === issuer
      );
    });

    return !!balance;
  };

  const formatSearchTokenRecords = (
    records:
      | SearchTokenResponse["_embedded"]["records"]
      | FormattedSearchTokenRecord[],
    currentBalances: (PricedBalance & {
      id: string;
    })[],
  ): FormattedSearchTokenRecord[] =>
    records
      .map((record) => {
        // Came from freighter-backend
        if ("tokenCode" in record) {
          return {
            ...record,
            hasTrustline: checkHasTrustline(
              currentBalances,
              record.tokenCode,
              record.issuer,
            ),
          };
        }

        const formattedTokenRecord = record.asset.split("-");
        const tokenCode = formattedTokenRecord[0];
        const issuer = formattedTokenRecord[1] ?? "";

        // Came from stellarExpert
        return {
          tokenCode,
          domain: record.domain ?? "",
          hasTrustline: checkHasTrustline(currentBalances, tokenCode, issuer),
          issuer,
          isNative: record.asset === NATIVE_TOKEN_CODE,
          tokenType: getTokenType(`${tokenCode}:${issuer}`),
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
        setStatus(HookStatus.IDLE);
        setSearchResults([]);
        return;
      }

      setStatus(HookStatus.LOADING);

      let resJson;

      if (isContractId(searchTerm)) {
        const lookupResult = await handleContractLookup(
          searchTerm,
          network,
          publicKey,
        ).catch(() => {
          setStatus(HookStatus.ERROR);
          return null;
        });

        resJson = lookupResult ? [lookupResult] : [];
      } else {
        const response = await searchToken(searchTerm, network);

        resJson = response && response._embedded && response._embedded.records;
      }

      if (!resJson) {
        setStatus(HookStatus.ERROR);
        return;
      }

      const formattedRecords = formatSearchTokenRecords(resJson, balanceItems);

      setSearchResults(formattedRecords);
      setStatus(HookStatus.SUCCESS);
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
    setStatus(HookStatus.IDLE);
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
