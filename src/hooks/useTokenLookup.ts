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
import { Icon, useTokenIconsStore } from "ducks/tokenIcons";
import {
  formatTokenIdentifier,
  getTokenIdentifier,
  getTokenType,
} from "helpers/balances";
import { isMainnet } from "helpers/networks";
import { isContractId } from "helpers/soroban";
import useDebounce from "hooks/useDebounce";
import { useState } from "react";
import { handleContractLookup } from "services/backend";
import { scanBulkTokens } from "services/blockaid/api";
import { SecurityLevel } from "services/blockaid/constants";
import { assessTokenSecurity } from "services/blockaid/helper";
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

  const { cacheTokenIcons } = useTokenIconsStore();

  // Group tokens by security level while preserving stellar.expert's original order
  const groupTokensBySecurityLevel = (
    tokens: FormattedSearchTokenRecord[],
  ): FormattedSearchTokenRecord[] => {
    const securityGroups: Record<SecurityLevel, FormattedSearchTokenRecord[]> =
      {
        [SecurityLevel.SAFE]: [],
        [SecurityLevel.SUSPICIOUS]: [],
        [SecurityLevel.MALICIOUS]: [],
      };

    // Preserve original order by adding tokens to groups as they appear
    tokens.forEach((token) => {
      const level = token.securityLevel as SecurityLevel;
      const targetGroup =
        securityGroups[level] || securityGroups[SecurityLevel.SUSPICIOUS];

      targetGroup.push(token);
    });

    // Return in security priority order: Safe → Suspicious → Malicious
    return [
      ...securityGroups[SecurityLevel.SAFE],
      ...securityGroups[SecurityLevel.SUSPICIOUS],
      ...securityGroups[SecurityLevel.MALICIOUS],
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
      const securityInfo = assessTokenSecurity(scanResult);

      return {
        ...token,
        isSuspicious: securityInfo.isSuspicious,
        isMalicious: securityInfo.isMalicious,
        securityLevel: securityInfo.level,
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
  ): FormattedSearchTokenRecord[] =>
    rawSearchResults.map((result) => {
      if ("tokenCode" in result) {
        // came from freighter-backend
        return {
          ...result,
          hasTrustline: hasExistingTrustline(
            userBalances,
            result.tokenCode,
            result.issuer,
          ),
        };
      }

      // came from stellar.expert
      const [tokenCode, issuer] = result.asset.split("-");

      return {
        tokenCode,
        domain: result.domain ?? "",
        hasTrustline: hasExistingTrustline(userBalances, tokenCode, issuer),
        issuer: issuer ?? "",
        isNative: result.asset === NATIVE_TOKEN_CODE,
        tokenType: getTokenType(`${tokenCode}:${issuer}`),
      };
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

        // Cache icons from stellar expert results so that TokenIcon can render them
        const icons = resJson?.reduce(
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

        if (icons) {
          cacheTokenIcons({ icons });
        }
      }

      if (!resJson) {
        setStatus(HookStatus.ERROR);
        return;
      }

      const formattedRecords = formatTokensFromSearchResults(
        resJson,
        balanceItems,
      );

      if (formattedRecords.length > 0 && isMainnet(network)) {
        try {
          const addressList = formattedRecords.map((token) =>
            token.issuer
              ? `${token.tokenCode}-${token.issuer}`
              : token.tokenCode,
          );

          const bulkScanResult = await scanBulkTokens({ addressList, network });
          const enhancedSearchResults = enhanceWithSecurityInfo(
            formattedRecords,
            bulkScanResult,
          );
          const groupedSearchResults = groupTokensBySecurityLevel(
            enhancedSearchResults,
          );

          setSearchResults(groupedSearchResults);
        } catch (error) {
          // If security scan fails, mark tokens as suspicious since we can't verify their safety
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
