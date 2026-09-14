export {
  classicUpdateDevice,
  classicUpdateDevices,
  convertToListDeviceData,
} from './classic-update-devices.ts'
export { fetchDevices } from './fetch-devices.ts'
// `setting` keys storage by accessor name, resolved once at decoration
// time — a data contract: hosts already hold values under these keys,
// so renaming a decorated accessor strands the stored value.
export { setting, syncDevices } from '@olivierzal/api-core'
