// electribe 2 SysEx function codes (spec §6.2).

export const SYSEX_FN = {
  // Requests (sent by app)
  CURRENT_PATTERN_DUMP_REQUEST: 0x10,
  PATTERN_DUMP_REQUEST: 0x1c, // + 2 bytes pattern num
  PATTERN_WRITE_REQUEST: 0x11, // + 2 bytes pattern num
  GLOBAL_DUMP_REQUEST: 0x1e,

  // Replies / data (sent by machine)
  CURRENT_PATTERN_DUMP: 0x40, // + 18725 bytes
  PATTERN_DUMP: 0x4c, // + 2 bytes pat num + 18725 bytes
  GLOBAL_DUMP: 0x51, // + 293 bytes

  // ACK / NAK (sent by machine)
  DATA_LOAD_COMPLETED: 0x23,
  DATA_LOAD_ERROR: 0x24,
  WRITE_COMPLETED: 0x21,
  WRITE_ERROR: 0x22,
  DATA_FORMAT_ERROR: 0x26,
} as const;
