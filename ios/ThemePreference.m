#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ThemePreference, NSObject)

RCT_EXTERN_METHOD(setThemePreference:(NSString *)value
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
