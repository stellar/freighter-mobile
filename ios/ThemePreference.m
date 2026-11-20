#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ThemePreference, NSObject)

RCT_EXTERN_METHOD(setThemePreference:(NSString *)value
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getSystemColorScheme:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(beginThemeTransition:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endThemeTransition:(nonnull NSNumber *)durationMs)

@end
