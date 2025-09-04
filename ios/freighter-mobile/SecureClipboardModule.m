#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SecureClipboardModule, NSObject)

RCT_EXTERN_METHOD(setString:(NSString *)text
                  expirationMs:(NSNumber *)expirationMs
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getString:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearString:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
