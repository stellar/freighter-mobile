require "json"

package = JSON.parse(File.read(File.join(__dir__, "..", "..", "package.json")))

Pod::Spec.new do |s|
  s.name         = "SecureClipboardModule"
  s.version      = package["version"]
  s.summary      = "Secure clipboard module for Freighter mobile app"
  s.description  = "A native module that provides secure clipboard functionality with platform-specific security enhancements"
  s.homepage     = "https://github.com/stellar/freighter"
  s.license      = "MIT"
  s.authors      = { "Stellar Development Foundation" => "hello@stellar.org" }
  s.platforms    = { :ios => "11.0" }
  s.source       = { :git => "https://github.com/stellar/freighter.git", :tag => "#{s.version}" }

  s.source_files = "ios/SecureClipboardModule.swift", "ios/SecureClipboardModule.m"
  s.requires_arc = true

  s.dependency "React-Core"
end
