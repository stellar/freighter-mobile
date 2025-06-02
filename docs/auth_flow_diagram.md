# Freighter Mobile Authentication Flow

```mermaid
flowchart TD
    Start([App Start]) --> InitStore[Initialize Store]
    InitStore --> LoadNetwork[Load Active Network from Storage]
    LoadNetwork --> CheckAuth{Get Auth Status}

    %% Auth Status Check Flow
    CheckAuth --> HasAccounts{Check if accounts exist}
    HasAccounts -->|No accounts| NotAuth[AUTH_STATUS.NOT_AUTHENTICATED]
    HasAccounts -->|Has accounts| CheckHashKey{Hash key exists?}

    CheckHashKey -->|No hash key| HashExpired[AUTH_STATUS.HASH_KEY_EXPIRED]
    CheckHashKey -->|Has hash key| CheckTempStore{Temporary store exists?}

    CheckTempStore -->|No temp store| HashExpired
    CheckTempStore -->|Has temp store| CheckExpiration{Hash key expired?}

    CheckExpiration -->|Expired| HashExpired
    CheckExpiration -->|Valid| Authenticated[AUTH_STATUS.AUTHENTICATED]

    %% Navigation based on auth status
    NotAuth --> ShowWelcome[Show Welcome Screen]
    HashExpired --> NavigateLock[Navigate to Lock Screen]
    Authenticated --> FetchAccount[Fetch Active Account]

    %% Sign Up Flow
    ShowWelcome --> SignUpAction{User chooses Sign Up}
    SignUpAction --> InputMnemonic[Input Mnemonic & Password]
    InputMnemonic --> DeriveKeyPair[Derive Key Pair from Mnemonic]
    DeriveKeyPair --> ClearAllData1[Clear All Existing Data]
    ClearAllData1 --> StoreAccount1[Store Account in Key Manager]
    StoreAccount1 --> GenerateHashKey1[Generate Hash Key from Password]
    GenerateHashKey1 --> CreateTempStore1[Create Encrypted Temporary Store]
    CreateTempStore1 --> SetAuthSuccess1[Set AUTH_STATUS.AUTHENTICATED]
    SetAuthSuccess1 --> FetchAccountSuccess1[Fetch Active Account]

    %% Import Wallet Flow
    ShowWelcome --> ImportAction{User chooses Import}
    ImportAction --> InputImportMnemonic[Input Mnemonic & Password]
    InputImportMnemonic --> DeriveImportKeyPair[Derive Key Pair from Mnemonic]
    DeriveImportKeyPair --> ClearAllData2[Clear All Existing Data]
    ClearAllData2 --> StoreAccount2[Store Account in Key Manager]
    StoreAccount2 --> GenerateHashKey2[Generate Hash Key from Password]
    GenerateHashKey2 --> CreateTempStore2[Create Encrypted Temporary Store]
    CreateTempStore2 --> VerifyExisting[Verify Existing Accounts on Network]

    VerifyExisting --> CheckNetworkAccounts{Check first 5 keypairs on mainnet}
    CheckNetworkAccounts --> FindExisting{Found existing accounts?}
    FindExisting -->|Yes| CheckLocal{Already exist locally?}
    FindExisting -->|No| SetAuthSuccess2[Set AUTH_STATUS.AUTHENTICATED]

    CheckLocal -->|Not local| CreateMissingAccounts[Create Missing Accounts]
    CheckLocal -->|Already local| SetAuthSuccess2
    CreateMissingAccounts --> UpdateTempStore[Update Temporary Store with new keys]
    UpdateTempStore --> SetAuthSuccess2
    SetAuthSuccess2 --> FetchAccountSuccess2[Fetch Active Account]

    %% Sign In Flow
    NavigateLock --> ShowLockScreen[Show Lock Screen with Public Key]
    ShowLockScreen --> InputPassword[User inputs password]
    InputPassword --> LoadKeyFromManager{Load key from Key Manager}

    LoadKeyFromManager -->|Invalid password| ShowPasswordError[Show Invalid Password Error]
    LoadKeyFromManager -->|Valid password| ValidateKeyData{Key has mnemonic data?}

    ShowPasswordError --> InputPassword
    ValidateKeyData -->|No mnemonic| ClearAllData3[Clear All Data - Corrupted]
    ValidateKeyData -->|Has mnemonic| FindAccountInList{Find account in account list?}

    ClearAllData3 --> ShowError1[Show Error: No Key Pair Found]
    FindAccountInList -->|Not found| CreateAccountEntry[Create account entry]
    FindAccountInList -->|Found| CreateInitialTempStore[Create Temporary Store with active account]

    CreateAccountEntry --> CreateInitialTempStore
    CreateInitialTempStore --> DiscoverNetworkAccounts[Discover existing accounts on network]
    DiscoverNetworkAccounts --> EnsureAllKeys[Ensure all account private keys in temp store]

    EnsureAllKeys --> LoadFromKeyManager{Try load from Key Manager}
    LoadFromKeyManager -->|Success| AddToTempStore[Add private key to temp store]
    LoadFromKeyManager -->|Failed| TryDerivation{Try derive from mnemonic}

    TryDerivation -->|Found match| AddToTempStore
    TryDerivation -->|No match| SkipAccount[Skip this account]
    AddToTempStore --> CheckMoreAccounts{More accounts to process?}
    SkipAccount --> CheckMoreAccounts

    CheckMoreAccounts -->|Yes| LoadFromKeyManager
    CheckMoreAccounts -->|No| UpdateFinalTempStore[Update final temporary store]
    UpdateFinalTempStore --> SetAuthSuccess3[Set AUTH_STATUS.AUTHENTICATED]
    SetAuthSuccess3 --> FetchAccountSuccess3[Fetch Active Account]

    %% Create Account Flow
    FetchAccount --> UserCreateAccount{User creates new account}
    UserCreateAccount --> LoadExistingKey[Load existing key from Key Manager]
    LoadExistingKey --> GetMnemonic[Extract mnemonic phrase]
    GetMnemonic --> FindUniqueIndex[Find unique account index]

    FindUniqueIndex --> CheckIndexExists{Index already exists?}
    CheckIndexExists -->|Yes| IncrementIndex[Increment index]
    CheckIndexExists -->|No| DeriveNewKeyPair[Derive new key pair]
    IncrementIndex --> CheckIndexExists

    DeriveNewKeyPair --> StoreNewAccount[Store new account in Key Manager]
    StoreNewAccount --> UpdateTempStoreNew[Update temporary store without refreshing hash key]
    UpdateTempStoreNew --> RefreshAccounts[Refresh all accounts and active account]

    %% Select Account Flow
    FetchAccount --> UserSelectAccount{User selects different account}
    UserSelectAccount --> ValidateSelection{Selected account exists?}
    ValidateSelection -->|No| ShowAccountError[Show Account Not Found Error]
    ValidateSelection -->|Yes| SetActiveAccount[Set as active account in storage]
    SetActiveAccount --> LoadSelectedAccount[Load selected account data]
    LoadSelectedAccount --> UpdateActiveState[Update active account state]

    %% Logout Flow
    FetchAccount --> UserLogout{User initiates logout}
    UserLogout --> CheckWipeFlag{Wipe all data flag?}
    CheckWipeFlag -->|Yes| ClearAllData4[Clear all data including accounts]
    CheckWipeFlag -->|No| CheckAccountsExist{Accounts exist?}

    CheckAccountsExist -->|No| ClearAllData4
    CheckAccountsExist -->|Yes| ClearSensitiveOnly[Clear only sensitive data]

    ClearAllData4 --> SetNotAuth[Set AUTH_STATUS.NOT_AUTHENTICATED]
    ClearSensitiveOnly --> SetHashExpired[Set AUTH_STATUS.HASH_KEY_EXPIRED]

    SetNotAuth --> ShowWelcome
    SetHashExpired --> NavigateLock

    %% Rename Account Flow
    FetchAccount --> UserRename{User renames account}
    UserRename --> UpdateAccountName[Update account name in storage]
    UpdateAccountName --> RefreshAccountData[Refresh account data and active account]

    %% Network Selection Flow
    FetchAccount --> UserSelectNetwork{User selects network}
    UserSelectNetwork --> SaveNetwork[Save network to storage]
    SaveNetwork --> UpdateNetworkState[Update network state]

    %% Error Handling
    ShowError1 --> ShowWelcome
    ShowAccountError --> FetchAccount

    %% Hash Key Expiration Detection
    FetchAccountSuccess1 --> MonitorExpiration{Monitor hash key expiration}
    FetchAccountSuccess2 --> MonitorExpiration
    FetchAccountSuccess3 --> MonitorExpiration
    RefreshAccounts --> MonitorExpiration
    UpdateActiveState --> MonitorExpiration
    RefreshAccountData --> MonitorExpiration

    MonitorExpiration -->|Key expires| AutoLogout[Auto logout to lock screen]
    MonitorExpiration -->|Key valid| ContinueSession[Continue session]

    AutoLogout --> NavigateLock
    ContinueSession --> FetchAccount

    %% Styling
    classDef authStatus fill:#e1f5fe
    classDef userAction fill:#fff3e0
    classDef errorState fill:#ffebee
    classDef successState fill:#e8f5e8
    classDef decisionPoint fill:#f3e5f5

    class NotAuth,HashExpired,Authenticated authStatus
    class SignUpAction,ImportAction,UserCreateAccount,UserSelectAccount,UserLogout,UserRename,UserSelectNetwork userAction
    class ShowPasswordError,ShowError1,ShowAccountError errorState
    class SetAuthSuccess1,SetAuthSuccess2,SetAuthSuccess3,FetchAccountSuccess1,FetchAccountSuccess2,FetchAccountSuccess3 successState
    class HasAccounts,CheckHashKey,CheckTempStore,CheckExpiration,LoadKeyFromManager,ValidateKeyData,FindAccountInList,CheckIndexExists,ValidateSelection,CheckWipeFlag,CheckAccountsExist decisionPoint
```

## Key Decision Points Explained:

### 1. **Authentication Status Check**

- **HasAccounts**: Determines if any accounts exist in storage
- **CheckHashKey**: Verifies if hash key exists for encryption/decryption
- **CheckTempStore**: Ensures temporary store with sensitive data exists
- **CheckExpiration**: Validates hash key hasn't expired (default: expires after
  time limit)

### 2. **Sign In Flow Conditionals**

- **LoadKeyFromManager**: Validates password against stored encrypted key
- **ValidateKeyData**: Ensures the key contains required mnemonic phrase data
- **FindAccountInList**: Checks if account exists in the account list

### 3. **Account Creation Logic**

- **CheckIndexExists**: Prevents duplicate accounts by finding unique derivation
  index
- **FindUniqueIndex**: Iterates through indices to find unused key pair

### 4. **Logout Decision Tree**

- **CheckWipeFlag**: Determines whether to clear all data or just sensitive data
- **CheckAccountsExist**: For partial logout, only clears sensitive data if
  accounts exist

### 5. **Network Account Discovery**

- **CheckNetworkAccounts**: Verifies first 5 keypairs against mainnet for
  existing accounts
- **CheckLocal**: Prevents creating duplicate local accounts

### 6. **Error Recovery**

- Hash key expiration automatically triggers navigation to lock screen
- Invalid password allows retry without data loss
- Corrupted key data triggers complete data wipe for security
