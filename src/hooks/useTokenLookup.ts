/* eslint-disable no-underscore-dangle */
import Blockaid from "@blockaid/client";
import { NATIVE_TOKEN_CODE, NETWORKS } from "config/constants";
import {
  PricedBalance,
  SearchTokenResponse,
  FormattedSearchTokenRecord,
  HookStatus,
  TokenTypeWithCustomToken,
} from "config/types";
import { useDebugStore } from "ducks/debug";
import { Icon } from "ducks/tokenIcons";
import {
  formatTokenIdentifier,
  getTokenIdentifier,
  getTokenType,
} from "helpers/balances";
import { isMainnet } from "helpers/networks";
import { isContractId } from "helpers/soroban";
import { useRef, useState } from "react";
import { handleContractLookup } from "services/backend";
import { scanBulkTokens } from "services/blockaid/api";
import { SecurityLevel } from "services/blockaid/constants";
import {
  assessTokenSecurity,
  extractSecurityWarnings,
} from "services/blockaid/helper";
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
  const latestRequestRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [searchResults, setSearchResults] = useState<
    FormattedSearchTokenRecord[]
  >([]);
  const [status, setStatus] = useState<HookStatus>(HookStatus.IDLE);
  const { overriddenBlockaidResponse } = useDebugStore();

  // Group tokens by security level while preserving stellar.expert's original order
  const groupTokensBySecurityLevel = (
    tokens: FormattedSearchTokenRecord[],
  ): FormattedSearchTokenRecord[] => {
    const securityGroups: Record<SecurityLevel, FormattedSearchTokenRecord[]> =
      {
        [SecurityLevel.SAFE]: [],
        [SecurityLevel.SUSPICIOUS]: [],
        [SecurityLevel.MALICIOUS]: [],
        [SecurityLevel.UNABLE_TO_SCAN]: [],
      };

    // Preserve original order by adding tokens to groups as they appear
    tokens.forEach((token) => {
      const level = token.securityLevel as SecurityLevel;
      const targetGroup =
        securityGroups[level] || securityGroups[SecurityLevel.SUSPICIOUS];

      targetGroup.push(token);
    });

    // Return in security priority order: Safe → Suspicious → Malicious → Unable to Scan
    return [
      ...securityGroups[SecurityLevel.SAFE],
      ...securityGroups[SecurityLevel.SUSPICIOUS],
      ...securityGroups[SecurityLevel.MALICIOUS],
      ...securityGroups[SecurityLevel.UNABLE_TO_SCAN],
    ];
  };

  // Add security assessment to each token
  const enhanceWithSecurityInfo = (
    tokens: FormattedSearchTokenRecord[],
    scanResults: Blockaid.TokenBulkScanResponse,
  ): FormattedSearchTokenRecord[] =>
    tokens.map((token) => {
      const tokenIdentifier = token.issuer
        ? `${token.tokenCode}-${token.issuer}`
        : token.tokenCode;

      const scanResult = scanResults.results?.[tokenIdentifier];
      const securityInfo = assessTokenSecurity(
        scanResult,
        overriddenBlockaidResponse,
      );

      return {
        ...token,
        isSuspicious: securityInfo.isSuspicious,
        isMalicious: securityInfo.isMalicious,
        securityLevel: securityInfo.level,
        securityWarnings: extractSecurityWarnings(scanResult),
      };
    });

  // Check if user already has a trustline for this token
  const hasExistingTrustline = (
    userBalances: (PricedBalance & { id: string })[],
    tokenCode: string,
    issuer: string,
  ): boolean => {
    const matchingBalance = userBalances.find((balance) => {
      const balanceToken = formatTokenIdentifier(balance.id);

      return (
        balanceToken.tokenCode === tokenCode && balanceToken.issuer === issuer
      );
    });

    return !!matchingBalance;
  };

  // Format tokens from different sources while preserving original order
  const formatTokensFromSearchResults = (
    rawSearchResults:
      | SearchTokenResponse["_embedded"]["records"]
      | FormattedSearchTokenRecord[],
    userBalances: (PricedBalance & { id: string })[],
    icons: Record<string, Icon> = {},
  ): FormattedSearchTokenRecord[] =>
    rawSearchResults.map((result) => {
      if ("tokenCode" in result) {
        // came from freighter-backend
        const tokenIdentifier = getTokenIdentifier({
          type: TokenTypeWithCustomToken.CUSTOM_TOKEN,
          code: result.tokenCode,
          issuer: {
            key: result.issuer,
          },
        });
        const iconUrl = icons[tokenIdentifier]?.imageUrl;
        return {
          ...result,
          iconUrl,
          hasTrustline: hasExistingTrustline(
            userBalances,
            result.tokenCode,
            result.issuer,
          ),
        };
      }

      // came from stellar.expert
      const [tokenCode, issuer] = result.asset.split("-");
      const tokenIdentifier = getTokenIdentifier({
        type: TokenTypeWithCustomToken.CUSTOM_TOKEN,
        code: tokenCode,
        issuer: {
          key: issuer,
        },
      });
      const iconUrl = icons[tokenIdentifier]?.imageUrl;

      return {
        tokenCode,
        domain: result.domain ?? "",
        hasTrustline: hasExistingTrustline(userBalances, tokenCode, issuer),
        iconUrl,
        issuer: issuer ?? "",
        isNative: result.asset === NATIVE_TOKEN_CODE,
        tokenType: getTokenType(`${tokenCode}:${issuer}`),
      };
    });

  const performSearch = async (term: string) => {
    const requestId = ++latestRequestRef.current;
    // Cancel previous request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    if (!term) {
      if (latestRequestRef.current === requestId) setStatus(HookStatus.IDLE);
      setSearchResults([]);
      return;
    }

    if (latestRequestRef.current === requestId) setStatus(HookStatus.LOADING);

    let resJson;
    let icons = {} as Record<string, Icon> | undefined;

    if (isContractId(term)) {
      const lookupResult = await handleContractLookup(
        term,
        network,
        publicKey,
        signal,
      ).catch(() => {
        if (signal.aborted) return null;
        setStatus(HookStatus.ERROR);
        return null;
      });

      if (signal.aborted) return;
      resJson = lookupResult ? [lookupResult] : [];
    } else {
      try {
        const response = await searchToken(term, network, signal);
        if (signal.aborted) return;

        resJson = response && response._embedded && response._embedded.records;

        icons = resJson?.reduce(
          (prev, curr) => {
            const tokenIdentifier = getTokenIdentifier({
              type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
              code: curr.tomlInfo?.code,
              issuer: {
                key: curr.tomlInfo?.issuer,
              },
            });
            const icon = {
              imageUrl: curr.tomlInfo?.image,
              network,
            };

            // eslint-disable-next-line no-param-reassign
            prev[tokenIdentifier] = icon;
            return prev;
          },
          {} as Record<string, Icon>,
        );
      } catch (error) {
        if (signal.aborted) return;
        setStatus(HookStatus.ERROR);
        return;
      }
    }

    if (!resJson) {
      setStatus(HookStatus.ERROR);
      return;
    }

    const formattedRecords = formatTokensFromSearchResults(
      resJson,
      balanceItems,
      icons,
    );

    if (formattedRecords.length > 0 && isMainnet(network)) {
      try {
        const addressList = formattedRecords
          .filter((record) => record.issuer)
          .map((token) => `${token.tokenCode}-${token.issuer}`);

        const bulkScanResult = await scanBulkTokens(
          { addressList, network },
          signal,
        );
        const enhancedSearchResults = enhanceWithSecurityInfo(
          formattedRecords,
          bulkScanResult,
        );
        const groupedSearchResults = groupTokensBySecurityLevel(
          enhancedSearchResults,
        );

        if (signal.aborted) return;
        setSearchResults(groupedSearchResults);
      } catch (error) {
        const fallbackSearchResults: FormattedSearchTokenRecord[] =
          formattedRecords.map((token) => ({
            ...token,
            isSuspicious: true,
            isMalicious: false,
            securityLevel: SecurityLevel.SUSPICIOUS,
          }));

        const groupedFallbackResults = groupTokensBySecurityLevel(
          fallbackSearchResults,
        );

        if (signal.aborted) return;
        setSearchResults(groupedFallbackResults);
      }
    } else {
      const defaultSearchResults: FormattedSearchTokenRecord[] =
        formattedRecords.map((token) => ({
          ...token,
          isSuspicious: false,
          isMalicious: false,
          securityLevel: SecurityLevel.SAFE,
        }));

      const groupedDefaultResults =
        groupTokensBySecurityLevel(defaultSearchResults);

      setSearchResults(groupedDefaultResults);
    }

    setStatus(HookStatus.SUCCESS);
  };

  const handleSearch = (text: string) => {
    performSearch(text);
  };

  const resetSearch = () => {
    abortControllerRef.current?.abort();
    setStatus(HookStatus.IDLE);
    setSearchResults([]);
  };

  return {
    searchResults,
    status,
    handleSearch,
    resetSearch,
  };
};
