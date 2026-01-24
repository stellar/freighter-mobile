# frozen_string_literal: true

module EnvFileCreator
  # Read environment variable names from .env.example file
  # Excludes keys containing "KEYSTORE" or "E2E_TEST" as we don't need them here
  def self.load_env_vars_from_example
    example_file = ".env.example"
    return [] unless File.exist?(example_file)

    File.readlines(example_file)
        .map(&:strip)
        .reject { |line| line.empty? || line.start_with?("#") }
        .map { |line| line.split("=", 2).first&.strip }
        .compact
        .reject { |key| key.empty? || key.include?("KEYSTORE") || key.include?("E2E_TEST") }
        .sort
        .freeze
  end

  # Environment variables that must be included in the .env file
  ENV_VARS = load_env_vars_from_example.freeze

  def self.create(env:)
    # Validate that all required .env file variables exist and have non-empty values
    missing_vars = ENV_VARS.select do |var_name|
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

    # Create .env file with non-empty values
    File.open(".env", "w") do |file|
      ENV_VARS.each do |var_name|
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

