require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "SecureClipboard"
  s.version      = package["version"]
  s.summary      = "Secure clipboard functionality for React Native"
  s.description  = "A React Native module that provides secure clipboard functionality with platform-specific enhancements"
  s.homepage     = "https://github.com/stellar/freighter-mobile"
  s.license      = "MIT"
  s.author       = { "Stellar Development Foundation" => "hello@stellar.org" }
  s.platforms    = { :ios => "11.0" }
  s.source       = { :git => "https://github.com/stellar/freighter-mobile.git", :tag => "#{s.version}" }
  s.source_files = "SecureClipboard.{swift,m}"
  s.dependency "React-Core"
end
