# frozen_string_literal: true

require_relative "env_file_creator"

class GHActionAndroid
  BUILD_GRADLE = File.read("./android/app/build.gradle")

  VERSION_NAME = BUILD_GRADLE[/versionName\s+"([\d.]+)"/, 1]

  CONFIG = {
    "prod" => {
      name: "Freighter",
      lane: "prod",
      app_id: "org.stellar.freighterwallet",
      version_name: VERSION_NAME
    },
    "dev" => {
      name: "Freighter Dev",
      lane: "dev",
      app_id: "org.stellar.freighterdev",
      version_name: VERSION_NAME
    }
  }.freeze

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
    set_flavor
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
      CONFIG.fetch(build_env[:android_flavor]).fetch(:lane)
  end

  def set_app_id
    build_env[:app_id] =
      CONFIG.fetch(build_env[:android_flavor]).fetch(:app_id)
  end

  def set_app_version
    build_env[:app_version] =
      CONFIG.fetch(build_env[:android_flavor]).fetch(:version_name)
  end

  def set_app_name
    build_env[:app_name] =
      CONFIG.fetch(build_env[:android_flavor]).fetch(:name)
  end

  def set_flavor
    ref_name = @env.fetch("REF_NAME")
    android_flavor = @env.fetch("ANDROID_FLAVOR")

    # If the flavor is set in the workflow dispatch, use it
    if android_flavor.to_s != ""
      build_env[:android_flavor] = android_flavor
      return
    end

    # Otherwise, default flavor based on the ref_name
    # Production builds are tagged with version numbers (e.g., v1.6.23)
    # Development builds use other patterns
    build_env[:android_flavor] = if ref_name.match?(/^v?\d+\.\d+\.\d+$/)
                                    "prod"
                                  else
                                    "dev"
                                  end
  end

  def output_env
    lines = build_env.map do |key, value|
      %[#{key.upcase}=#{value}]
    end

    "\n#{lines.join("\n")}\n"
  end
end

