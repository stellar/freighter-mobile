const ViewShot = jest.fn().mockImplementation(({ children, ...props }) => ({
  type: "View",
  props: { ...props, children },
  capture: jest.fn().mockResolvedValue("data:image/png;base64,mock-screenshot"),
}));

export default ViewShot;
