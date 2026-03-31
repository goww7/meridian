CREATE OR REPLACE FUNCTION generate_ulid() RETURNS TEXT AS $$
DECLARE
  timestamp BIGINT;
  output TEXT := '';
  unix_ts BIGINT;
  encoding TEXT := '0123456789abcdefghjkmnpqrstvwxyz';
  i INT;
BEGIN
  unix_ts := EXTRACT(EPOCH FROM clock_timestamp()) * 1000;
  FOR i IN REVERSE 9..0 LOOP
    output := substr(encoding, (unix_ts % 32)::INT + 1, 1) || output;
    unix_ts := unix_ts >> 5;
  END LOOP;
  FOR i IN 1..16 LOOP
    output := output || substr(encoding, (floor(random() * 32))::INT + 1, 1);
  END LOOP;
  RETURN output;
END;
$$ LANGUAGE plpgsql VOLATILE;
