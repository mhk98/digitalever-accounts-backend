# Attendance API Vendor Integration Sheet

## Purpose
This document is for the biometric machine vendor / WDMS engineer.

Goal:
- connect biometric machine to WDMS or middleware
- send realtime attendance punch data to our software API
- verify punch -> raw log -> summary flow

## Integration Target

### Realtime Attendance Endpoint
`POST /api/v1/attendance-log/realtime-ingest`

### Base URL
Fill this from deployment:

`https://YOUR-DOMAIN.COM`

Example:

`https://accounts.example.com/api/v1/attendance-log/realtime-ingest`

## Required Header

`x-device-key: YOUR_DEVICE_API_KEY`

Optional when testing from authenticated admin panel:
- `Authorization: Bearer <token>`

For live machine / WDMS integration, use:
- `x-device-key`

## Required Payload

```json
{
  "deviceIdentifier": "HO-ZK-01",
  "deviceUserId": "101",
  "punchTime": "2026-04-13T09:03:00+06:00",
  "punchType": "in",
  "verificationMethod": "face"
}
```

## Payload Field Meaning

- `deviceIdentifier`
  Unique identifier for the machine in our software.
  Example: `HO-ZK-01`

- `deviceUserId`
  Employee user ID as stored in the biometric machine / WDMS.
  This must match our attendance enrollment mapping.

- `punchTime`
  Exact date-time of punch in ISO format with timezone.
  Example: `2026-04-13T09:03:00+06:00`

- `punchType`
  Allowed values:
  - `check`
  - `in`
  - `out`

- `verificationMethod`
  Allowed values:
  - `face`
  - `fingerprint`
  - `card`

## Optional Payload

```json
{
  "attendanceDeviceId": 1,
  "deviceCode": "HO-01",
  "autoProcess": true,
  "sourcePayload": {
    "vendorRawData": "optional raw object"
  }
}
```

## Example cURL

```bash
curl -X POST "https://YOUR-DOMAIN.COM/api/v1/attendance-log/realtime-ingest" \
  -H "Content-Type: application/json" \
  -H "x-device-key: YOUR_DEVICE_API_KEY" \
  -d '{
    "deviceIdentifier": "HO-ZK-01",
    "deviceUserId": "101",
    "punchTime": "2026-04-13T09:03:00+06:00",
    "punchType": "in",
    "verificationMethod": "face"
  }'
```

## Expected Success Response

```json
{
  "success": true,
  "message": "Realtime attendance log received successfully",
  "data": {
    "duplicate": false,
    "processedRealtime": true,
    "processingResult": {
      "date": "2026-04-13",
      "processedEmployees": 1
    },
    "log": {
      "Id": 123
    }
  }
}
```

## Expected Duplicate Response

```json
{
  "success": true,
  "message": "Duplicate realtime attendance log ignored",
  "data": {
    "duplicate": true
  }
}
```

## Common Error Cases

- `401 Invalid device API key`
  Wrong `x-device-key`

- `404 Attendance device was not found`
  Wrong `deviceIdentifier` or device not created in system

- `400 deviceUserId and punchTime are required`
  Required field missing

- employee unmatched
  Punch may save as raw log but not resolve to employee until enrollment mapping is done

## Device Information To Be Shared With Vendor

Fill this before live integration:

- Base URL: `________________________`
- Realtime Endpoint: `/api/v1/attendance-log/realtime-ingest`
- Device Name: `________________________`
- Device Identifier: `________________________`
- Device API Key: `________________________`
- Branch: `________________________`
- Sync Method: `WDMS`

## Machine / WDMS Requirements

- machine must support `ADMS / Push`
- WDMS must be able to send or export realtime punch transactions
- machine user IDs must remain stable
- timezone must be correct
- realtime transaction format must include employee/device user reference and punch time

## Internal Data Mapping Requirement

Before live punch test, these must already exist in our software:

- attendance device entry
- employee master entry
- attendance enrollment mapping
  `deviceUserId -> employee`

## Minimum Live Test Checklist

1. machine installed
2. WDMS connected
3. first punch received by API
4. raw log visible in Attendance Logs
5. employee resolved correctly
6. summary generated in Attendance Summaries
7. duplicate test verified

## Support Notes

- punch data should go to our API, not directly to database
- machine -> WDMS/middleware -> API -> database is the target flow
- if vendor payload differs, vendor must share sample raw payload first

## Your Team Must Fill Before Sharing

- live domain / URL
- actual device identifier
- actual device API key
- support contact name
- support phone / WhatsApp
