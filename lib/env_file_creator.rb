# frozen_string_literal: true

module EnvFileCreator
  # Read environment variable names from .env.example file.
  # KEYSTORE keys are excluded (not needed in app .env). E2E_TEST keys are optional.
  def self.load_env_vars_from_example
    example_file = ".env.example"
    return { required: [], optional: [] } unless File.exist?(example_file)

    keys = File.readlines(example_file)
               .map(&:strip)
               .reject { |line| line.empty? || line.start_with?("#") }
               .map { |line| line.split("=", 2).first&.strip }
               .compact
               .reject(&:empty?)

    required = keys.reject { |k| k.include?("KEYSTORE") || k.include?("E2E_TEST") }.sort.freeze
    optional = keys.select { |k| k.include?("E2E_TEST") }.sort.freeze
    { required: required, optional: optional }
  end

  ENV_VARS = load_env_vars_from_example

  # Environment variables that must be included in the .env file
  REQUIRED_ENV_VARS = ENV_VARS[:required].freeze
  # Optional: included only when defined (e.g. E2E_TEST_*); omit otherwise
  OPTIONAL_ENV_VARS = ENV_VARS[:optional].freeze

  def self.create(env:)
    # Validate that all required .env variables exist and have non-empty values
    missing_vars = REQUIRED_ENV_VARS.select do |var_name|
      !env.key?(var_name) || env[var_name].nil? || env[var_name].to_s.empty?
    end

    unless missing_vars.empty?
      $stderr.puts "❌ Error: Missing required environment variables:"
      missing_vars.each do |var_name|
        $stderr.puts "  - #{var_name}"
      end
      $stderr.puts "\nPlease ensure all required variables are set in your repository variables/secrets."
      raise "Missing required environment variables: #{missing_vars.join(', ')}"
    end

    # Warn if optional E2E_TEST vars are missing (needed for E2E test flows)
    missing_optional_vars = OPTIONAL_ENV_VARS.select do |var_name|
      !env.key?(var_name) || env[var_name].nil? || env[var_name].to_s.empty?
    end

    unless missing_optional_vars.empty?
      $stderr.puts "⚠️  Warning: Missing optional environment variables:"
      missing_optional_vars.each do |var_name|
        $stderr.puts "  - #{var_name}"
      end
      $stderr.puts "\nThese variables are optional but may be required for E2E test flows."
      $stderr.puts "Please ensure they are set in your repository variables/secrets if needed.\n"
    end

    # Create .env: required vars (all present) + optional vars only when defined
    vars_to_write = REQUIRED_ENV_VARS + OPTIONAL_ENV_VARS
    File.open(".env", "w") do |file|
      vars_to_write.each do |var_name|
        value = env[var_name]
        file.puts("#{var_name}=#{value}") if value && !value.to_s.empty?
      end
    end

    $stderr.puts "✅ Created .env file"
    log_created_file
  end

  def self.log_created_file
    return unless File.exist?(".env")

    require "digest"
    $stderr.puts "\n📋 .env file contents (values hashed):"
    File.readlines(".env").each do |line|
      line = line.strip
      next if line.empty?

      key, value = line.split("=", 2)
      if value && !value.empty?
        hash = Digest::SHA256.hexdigest(value)
        $stderr.puts "  #{key}=#{hash[0..15]}... (#{value.length} chars)"
      else
        $stderr.puts "  #{key}=(empty)"
      end
    end
    $stderr.puts ""
  end
end

