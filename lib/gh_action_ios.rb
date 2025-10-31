# frozen_string_literal: true

require_relative "env_file_creator"

class GHActionIOS
  CONFIG = {
    "freighter-mobile" => {
      name: "Freighter",
      lane: "prod",
      app_id: "org.stellar.freighterwallet",
      plist: "ios/freighter-mobile/Info.plist"
    },
    "freighter-mobile-dev" => {
      name: "Freighter Dev",
      lane: "dev",
      app_id: "org.stellar.freighterdev",
      plist: "ios/freighter-mobile/Info-Dev.plist"
    }
  }.freeze

  def self.app_version(plist)
    `/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' #{plist}`
      .chomp
  end

  def self.call(env:)
    new(env: env).call
  end

  def initialize(env:)
    @env = env
  end

  def build_env
    @build_env ||= {
      build_version: Time.now.to_i
    }
  end

  def call
    create_env
    create_env_file
    output_env
  end

  def create_env
    set_scheme
    set_fastlane
    set_app_id
    set_app_version
    set_app_name
  end

  def create_env_file
    EnvFileCreator.create(env: @env)
    build_env[:envfile] = ".env"
  end

  def set_fastlane
    build_env[:fastlane_lane] =
      CONFIG.fetch(build_env[:ios_scheme]).fetch(:lane)
  end

  def set_app_id
    build_env[:app_id] =
      CONFIG.fetch(build_env[:ios_scheme]).fetch(:app_id)
  end

  def set_app_version
    plist = CONFIG.fetch(build_env[:ios_scheme]).fetch(:plist)

    build_env[:app_version] = self.class.app_version(plist)
  end

  def set_app_name
    build_env[:app_name] =
      CONFIG.fetch(build_env[:ios_scheme]).fetch(:name)
  end

  def set_scheme
    ref_name = @env.fetch("REF_NAME")
    ios_scheme = @env.fetch("IOS_SCHEME")

    if ios_scheme.to_s != ""
      build_env[:ios_scheme] = ios_scheme
      return
    end

    # Default scheme based on ref_name
    # Production builds are tagged with version numbers (e.g., v1.6.23)
    # Development builds use other patterns
    build_env[:ios_scheme] = if ref_name.match?(/^v?\d+\.\d+\.\d+$/)
                                "freighter-mobile"
                              else
                                "freighter-mobile-dev"
                              end
  end

  def output_env
    lines = build_env.map do |key, value|
      %[#{key.upcase}=#{value}]
    end

    "\n#{lines.join("\n")}\n"
  end
end

