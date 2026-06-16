#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PrivacyShield, NSObject)

RCT_EXTERN_METHOD(hide:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
